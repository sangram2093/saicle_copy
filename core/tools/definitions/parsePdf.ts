import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const parsePdfTool: Tool = {
  type: "function",
  displayTitle: "Parse PDF",
  wouldLikeTo: "parse a PDF for text",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ParsePdf,
    description: "Extract text (and metadata) from a PDF file.",
    parameters: {
      type: "object",
      required: ["pdfPath"],
      properties: {
        pdfPath: {
          type: "string",
          description:
            "Absolute or workspace-relative path to the PDF to parse.",
        },
      },
    },
  },
};
