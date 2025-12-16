import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const parsePdfTool: Tool = {
  type: "function",
  displayTitle: "Parse PDF",
  wouldLikeTo: "parse a PDF for text and (optionally) page images",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ParsePdf,
    description:
      "Extract text (and optionally rendered page images) from a PDF file. Best-effort image extraction; falls back to text-only if rendering is unavailable.",
    parameters: {
      type: "object",
      required: ["pdfPath"],
      properties: {
        pdfPath: {
          type: "string",
          description:
            "Absolute or workspace-relative path to the PDF to parse.",
        },
        includeImages: {
          type: "boolean",
          description:
            "If true, attempt to render each page to a PNG data URL (may be slow on large PDFs).",
          default: false,
        },
        maxPages: {
          type: "number",
          description:
            "Optional limit on number of pages to render as images (useful for large PDFs).",
        },
      },
    },
  },
};
