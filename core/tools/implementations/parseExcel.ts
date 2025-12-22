import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";

import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getNumberArg, getOptionalStringArg, getStringArg } from "../parseArgs";
import { resolveRelativePathInDir } from "../../util/ideUtils";
import { DEFAULT_CHUNK_SIZE_CHARS } from "./parsePdfHelpers";

type ParseExcelArgs = {
  excelPath: string;
  sheetName?: string;
  maxRows?: number;
  chunkSizeChars?: number;
};

function sheetToRows(sheet: XLSX.Sheet, maxRows?: number): any[][] {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][];
  if (maxRows && maxRows > 0) {
    return rows.slice(0, maxRows);
  }
  return rows;
}

function formatJson(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return `${obj}`;
  }
}

function asString(val: any): string {
  if (val === null || typeof val === "undefined") return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function rowsToMarkdownChunks(
  rows: any[][],
  chunkSize: number,
): { chunks: string[]; header: string[] } {
  if (!rows.length) {
    return { chunks: ["# Excel Chunks\n\n(No rows found)"], header: [] };
  }
  const header = rows[0].map((h: any, idx: number) => asString(h) || `col_${idx + 1}`);
  const dataRows = rows.slice(1);

  const headerLine = `| ${header.join(" | ")} |`;
  const sepLine = `| ${header.map(() => "---").join(" | ")} |`;

  const chunks: string[] = [];
  let current: string[] = [headerLine, sepLine];

  for (const row of dataRows) {
    const rowLine = `| ${header
      .map((_, idx) => asString(row[idx] ?? ""))
      .join(" | ")} |`;
    const prospective = [...current, rowLine].join("\n");
    if (prospective.length > chunkSize && current.length > 2) {
      chunks.push(current.join("\n"));
      current = [headerLine, sepLine, rowLine];
    } else {
      current.push(rowLine);
    }
  }
  if (current.length) {
    chunks.push(current.join("\n"));
  }

  const withHeadings = chunks.map(
    (chunk, idx) => `## Chunk ${idx + 1}\n\n${chunk}\n`,
  );

  return { chunks: withHeadings, header };
}

export const parseExcelImpl: ToolImpl = async (args: ParseExcelArgs, extras) => {
  const requestedPath = getStringArg(args, "excelPath");
  const resolvedUri = await resolveRelativePathInDir(requestedPath, extras.ide);
  if (!resolvedUri) {
    throw new Error(`Excel file not found: ${requestedPath}`);
  }

  const excelPath =
    resolvedUri.startsWith("file://") || resolvedUri.startsWith("file:")
      ? fileURLToPath(resolvedUri)
      : path.resolve(requestedPath);

  const sheetName = getOptionalStringArg(args, "sheetName");
  const maxRows =
    typeof args?.maxRows !== "undefined" ? getNumberArg(args as any, "maxRows") : 200;
  const chunkSize =
    typeof args?.chunkSizeChars !== "undefined"
      ? getNumberArg(args as any, "chunkSizeChars")
      : DEFAULT_CHUNK_SIZE_CHARS;

  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found: ${excelPath}`);
  }

  const workbook = XLSX.readFile(excelPath);
  const allSheets = workbook.SheetNames;
  const targetSheetName = sheetName || allSheets[0];
  if (!targetSheetName) {
    throw new Error("No sheets found in workbook.");
  }
  if (!allSheets.includes(targetSheetName)) {
    throw new Error(
      `Sheet "${targetSheetName}" not found. Available sheets: ${allSheets.join(", ")}`,
    );
  }

  const sheet = workbook.Sheets[targetSheetName];
  const rows = sheetToRows(sheet, maxRows);
  const { chunks } = rowsToMarkdownChunks(rows, chunkSize);

  const markdownChunks =
    chunks.length === 0
      ? "# Excel Chunks\n\n(No rows found)"
      : [`# Excel Chunks (size ~${chunkSize} chars)\n`, ...chunks].join("\n");

  const contextItems: ContextItem[] = [
    {
      name: "Excel Chunks (markdown)",
      description: `Chunked rows from sheet "${targetSheetName}"`,
      content: markdownChunks,
    },
    {
      name: "Excel Metadata",
      description: "Sheets available and limits applied",
      content: `\`\`\`json\n${formatJson({
        sheets: allSheets,
        sheetUsed: targetSheetName,
        rowsReturned: rows.length,
        maxRows,
      })}\n\`\`\``,
    },
  ];

  return contextItems;
};
