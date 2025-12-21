import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const parsePdfTool: Tool = {
  type: "function",
  displayTitle: "Parse PDF",
  wouldLikeTo: "parse a PDF for text and chunk it into markdown",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ParsePdf,
    description:
      "Extract text from a PDF, chunk it, and return markdown plus metadata for downstream tools.",
    parameters: {
      type: "object",
      required: ["pdfPath"],
      properties: {
        pdfPath: {
          type: "string",
          description:
            "Absolute or workspace-relative path to the PDF to parse.",
        },
        chunkSizeChars: {
          type: "number",
          description:
            "Max characters per chunk (default 12000, or env AURA_PDF_CHUNK_SIZE_CHARS).",
        },
      },
    },
  },
};
