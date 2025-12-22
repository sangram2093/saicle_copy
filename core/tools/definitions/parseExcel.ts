import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const parseExcelTool: Tool = {
  type: "function",
  displayTitle: "Parse Excel",
  wouldLikeTo: "parse an Excel file into chunked markdown rows",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ParseExcel,
    description:
      "Extract sheet names and row data from an Excel file (xlsx/xls) and return chunked markdown for the selected sheet.",
    parameters: {
      type: "object",
      required: ["excelPath"],
      properties: {
        excelPath: {
          type: "string",
          description:
            "Absolute or workspace-relative path to the Excel file.",
        },
        sheetName: {
          type: "string",
          description:
            "Optional sheet name to read; if omitted, the first sheet is used.",
        },
        maxRows: {
          type: "number",
          description:
            "Optional row limit per sheet to avoid huge outputs (default 200).",
        },
        chunkSizeChars: {
          type: "number",
          description: "Optional chunk size override (chars) for markdown chunks.",
        },
      },
    },
  },
};
