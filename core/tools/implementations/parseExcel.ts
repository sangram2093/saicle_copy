import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getNumberArg, getOptionalStringArg, getStringArg } from "../parseArgs";

type ParseExcelArgs = {
  excelPath: string;
  sheetName?: string;
  maxRows?: number;
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

export const parseExcelImpl: ToolImpl = async (args: ParseExcelArgs, extras) => {
  const excelPath = path.resolve(getStringArg(args, "excelPath"));
  const sheetName = getOptionalStringArg(args, "sheetName");
  const maxRows =
    typeof args?.maxRows !== "undefined" ? getNumberArg(args as any, "maxRows") : 200;

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

  const contextItems: ContextItem[] = [
    {
      name: "Excel Metadata",
      description: "Sheets available",
      content: `\`\`\`json\n${formatJson({ sheets: allSheets })}\n\`\`\``,
    },
    {
      name: "Excel Rows",
      description: `First ${maxRows || rows.length} rows from sheet "${targetSheetName}"`,
      content: `\`\`\`json\n${formatJson(rows)}\n\`\`\``,
    },
  ];

  return contextItems;
};
