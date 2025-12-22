import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mammoth from "mammoth";

import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getBooleanArg, getNumberArg, getStringArg } from "../parseArgs";
import { resolveRelativePathInDir } from "../../util/ideUtils";
import { chunkText, DEFAULT_CHUNK_SIZE_CHARS } from "./parsePdfHelpers";

type ParseDocxArgs = {
  docxPath: string;
  includeHtml?: boolean;
  chunkSizeChars?: number;
};

function formatJson(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return `${obj}`;
  }
}

export const parseDocxImpl: ToolImpl = async (args: ParseDocxArgs, extras) => {
  const requestedPath = getStringArg(args, "docxPath");
  const resolvedUri = await resolveRelativePathInDir(requestedPath, extras.ide);
  if (!resolvedUri) {
    throw new Error(`DOCX not found: ${requestedPath}`);
  }

  const docxPath =
    resolvedUri.startsWith("file://") || resolvedUri.startsWith("file:")
      ? fileURLToPath(resolvedUri)
      : path.resolve(requestedPath);

  const includeHtml =
    getBooleanArg(args as any, "includeHtml", false) ?? false;
  const chunkSize =
    typeof args.chunkSizeChars !== "undefined"
      ? getNumberArg(args as any, "chunkSizeChars")
      : DEFAULT_CHUNK_SIZE_CHARS;

  if (!fs.existsSync(docxPath)) {
    throw new Error(`DOCX not found: ${docxPath}`);
  }

  const buffer = await fs.promises.readFile(docxPath);
  const textResult = await mammoth.extractRawText({ buffer });
  const htmlResult = includeHtml
    ? await mammoth.convertToHtml({ buffer })
    : undefined;

  const chunks = chunkText(textResult.value || "", chunkSize);
  const markdownChunks =
    chunks.length === 0
      ? "# DOCX Chunks\n\n(No text extracted)"
      : [
          `# DOCX Chunks (size ~${chunkSize} chars)\n`,
          ...chunks.map(
            (chunk, idx) => `## Chunk ${idx + 1}\n\n${chunk.trim()}\n`,
          ),
        ].join("\n");

  const contextItems: ContextItem[] = [
    {
      name: "DOCX Chunks (markdown)",
      description: `Chunked text from ${path.basename(docxPath)}`,
      content: markdownChunks,
    },
  ];

  if (includeHtml && htmlResult) {
    contextItems.push({
      name: "DOCX HTML",
      description: "HTML conversion",
      content: htmlResult.value,
    });
  }

  contextItems.push({
    name: "DOCX Metadata",
    description: "Metadata and stats",
    content: `\`\`\`json\n${formatJson({
      length: textResult.value?.length || 0,
    })}\n\`\`\``,
  });

  if (textResult.messages?.length || htmlResult?.messages?.length) {
    contextItems.push({
      name: "DOCX Warnings",
      description: "Conversion messages",
      content: `\`\`\`json\n${formatJson([
        ...(textResult.messages || []),
        ...(htmlResult?.messages || []),
      ])}\n\`\`\``,
    });
  }

  return contextItems;
};
