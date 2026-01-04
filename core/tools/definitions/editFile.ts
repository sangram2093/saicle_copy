import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export interface EditToolArgs {
  filepath: string;
  changes: string;
}

export const NO_PARALLEL_TOOL_CALLING_INSTRUCTION =
  "This tool CANNOT be called in parallel with other tools.";

const CHANGES_DESCRIPTION =
  "Important! You MUST always return the complete contents of the final file with all unchanged sections included (no placeholders, no ellipsis, and no tags like 'UNCHANGED CODE' , '// ... existing code ...'. or any similar ellipsis placeholders). Do NOT wrap this in a code block or include explainations. ALL placeholder Tags are forbidden. Do NOT generate only the changed portion. You must include all unchanged sections including honoring of <code from original file, proceeding> and <code from original file, succeeding> portion to include proceeding and succeeding portions of the original file previous and next to the change respectively. If uncertain default to full file output.";

export const editFileTool: Tool = {
  type: "function",
  displayTitle: "Edit File",
  wouldLikeTo: "edit {{{ filepath }}}",
  isCurrently: "editing {{{ filepath }}}",
  hasAlready: "edited {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: false,
  function: {
    name: BuiltInToolNames.EditExistingFile,
    description: `Use this tool to edit an existing file. If you don't know the contents of the file, read it first.\n${NO_PARALLEL_TOOL_CALLING_INSTRUCTION}\n You MUST always output the FULL updated file (i.e. NO placeholders of any kind, NO ellipsis , and NO tags like 'UNCHANGED CODE' , '// ... existing code ...'. or any similar ellipsis placeholders).`,
    parameters: {
      type: "object",
      required: ["filepath", "changes"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to edit, relative to the root of the workspace (file URIs and absolute paths are also accepted).",
        },
        changes: {
          type: "string",
          description: CHANGES_DESCRIPTION,
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To edit an EXISTING file, use the ${BuiltInToolNames.EditExistingFile} tool with
- filepath: the relative filepath to the file.
- changes: ${CHANGES_DESCRIPTION}
Only use this tool if you already know the contents of the file. Otherwise, use the ${BuiltInToolNames.ReadFile} or ${BuiltInToolNames.ReadCurrentlyOpenFile} tool to read it first.
ALWAYS return the complete updated file (i.e. NO placeholders of any form, including '// ... existing code ...', 'UNCHANGED CODE', '... rest of code ...', '... omitted ...' etc.). if uncertain, default to full file output. You MUST include all unchanged sections honoring <code from original file, preceeding> and <code from original file, succeeding> portions to include preceeding and succeeding portions of the original file contents previous and next to the change respectively.

For example:`,
    exampleArgs: [
      ["filepath", "path/to/the_file.ts"],
      [
        "changes",
        "<code from original file, preceeding>\nfunction subtract(a: number, b: number): number {\n  return a - b;\n}\n<code from original file, succeeding>",
      ],
    ],
  },
};
