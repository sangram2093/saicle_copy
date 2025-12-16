import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const parseDocxTool: Tool = {
  type: "function",
  displayTitle: "Parse DOCX",
  wouldLikeTo: "parse a DOCX into text (and optional HTML)",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ParseDocx,
    description:
      "Extract plain text from a DOCX file and optionally include HTML.",
    parameters: {
      type: "object",
      required: ["docxPath"],
      properties: {
        docxPath: {
          type: "string",
          description:
            "Absolute or workspace-relative path to the DOCX file.",
        },
        includeHtml: {
          type: "boolean",
          description: "If true, include HTML conversion alongside plain text.",
          default: false,
        },
      },
    },
  },
};
