import fs from "fs";
import path from "path";
import mammoth from "mammoth";

import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getBooleanArg, getStringArg } from "../parseArgs";

type ParseDocxArgs = {
  docxPath: string;
  includeHtml?: boolean;
};

function formatJson(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return `${obj}`;
  }
}

export const parseDocxImpl: ToolImpl = async (args: ParseDocxArgs, extras) => {
  const docxPath = path.resolve(getStringArg(args, "docxPath"));
  const includeHtml =
    getBooleanArg(args as any, "includeHtml", false) ?? false;

  if (!fs.existsSync(docxPath)) {
    throw new Error(`DOCX not found: ${docxPath}`);
  }

  const buffer = await fs.promises.readFile(docxPath);
  const textResult = await mammoth.extractRawText({ buffer });
  const htmlResult = includeHtml
    ? await mammoth.convertToHtml({ buffer })
    : undefined;

  const contextItems: ContextItem[] = [
    {
      name: "DOCX Text",
      description: `Plain text from ${path.basename(docxPath)}`,
      content: textResult.value,
    },
  ];

  if (includeHtml && htmlResult) {
    contextItems.push({
      name: "DOCX HTML",
      description: "HTML conversion",
      content: htmlResult.value,
    });
  }

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
