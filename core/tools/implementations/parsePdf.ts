import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getStringArg } from "../parseArgs";
import { resolveRelativePathInDir } from "../../util/ideUtils";
import { getNumberArg } from "../parseArgs";
import { chunkText, DEFAULT_CHUNK_SIZE_CHARS } from "./parsePdfHelpers";

type ParsePdfArgs = {
  pdfPath: string;
  chunkSizeChars?: number;
};

function formatJson(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return `${obj}`;
  }
}

export const parsePdfImpl: ToolImpl = async (args: ParsePdfArgs, extras) => {
  const requestedPath = getStringArg(args, "pdfPath").trim();
  let pdfPath: string;
  if (requestedPath.startsWith("file:")) {
    pdfPath = fileURLToPath(requestedPath);
  } else if (path.isAbsolute(requestedPath)) {
    pdfPath = requestedPath;
  } else {
    const resolvedUri = await resolveRelativePathInDir(
      requestedPath,
      extras.ide,
    );
    if (!resolvedUri) {
      throw new Error(`PDF not found: ${requestedPath}`);
    }
    pdfPath =
      resolvedUri.startsWith("file://") || resolvedUri.startsWith("file:")
        ? fileURLToPath(resolvedUri)
        : path.resolve(requestedPath);
  }

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  const chunkSize =
    typeof args.chunkSizeChars !== "undefined"
      ? getNumberArg(args as any, "chunkSizeChars")
      : DEFAULT_CHUNK_SIZE_CHARS;

  // Lazy require the library module (not the package entry, which self-tests).
  // @ts-ignore pdf-parse has no bundled types
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");

  const buffer = await fs.promises.readFile(pdfPath);
  const parsed = await pdfParse(buffer);
  const chunks = chunkText(parsed.text || "", chunkSize);

  const markdownChunks =
    chunks.length === 0
      ? "# PDF Chunks\n\n(No text extracted)"
      : [
          `# PDF Chunks (size ~${chunkSize} chars)\n`,
          ...chunks.map(
            (chunk, idx) => `## Chunk ${idx + 1}\n\n${chunk.trim()}\n`,
          ),
        ].join("\n");

  const contextItems: ContextItem[] = [
    {
      name: "PDF Chunks (markdown)",
      description: `Chunked text from ${path.basename(pdfPath)}`,
      content: markdownChunks,
    },
    {
      name: "PDF Metadata",
      description: "Metadata and stats",
      content: `\`\`\`json\n${formatJson({
        pages: parsed.numpages,
        info: parsed.info,
        version: parsed.version,
      })}\n\`\`\``,
    },
  ];

  return contextItems;
};
