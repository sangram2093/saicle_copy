import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getStringArg } from "../parseArgs";
import { resolveRelativePathInDir } from "../../util/ideUtils";

type ParsePdfArgs = {
  pdfPath: string;
};

function formatJson(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return `${obj}`;
  }
}

export const parsePdfImpl: ToolImpl = async (args: ParsePdfArgs, extras) => {
  const requestedPath = getStringArg(args, "pdfPath");
  const resolvedUri = await resolveRelativePathInDir(requestedPath, extras.ide);
  if (!resolvedUri) {
    throw new Error(`PDF not found: ${requestedPath}`);
  }

  const pdfPath =
    resolvedUri.startsWith("file://") || resolvedUri.startsWith("file:")
      ? fileURLToPath(resolvedUri)
      : path.resolve(requestedPath);

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  // Lazy require the library module (not the package entry, which self-tests).
  // @ts-ignore pdf-parse has no bundled types
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");

  const buffer = await fs.promises.readFile(pdfPath);
  const parsed = await pdfParse(buffer);

  const contextItems: ContextItem[] = [
    {
      name: "PDF Text",
      description: `Extracted text from ${path.basename(pdfPath)}`,
      content: parsed.text,
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
