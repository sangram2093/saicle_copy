import fs from "fs";
import path from "path";

import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getStringArg } from "../parseArgs";

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
  const pdfPath = path.resolve(getStringArg(args, "pdfPath"));

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  // Lazy load to avoid bundling native/test assets unless the tool is invoked.
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;

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
