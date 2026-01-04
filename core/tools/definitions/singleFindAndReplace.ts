import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { NO_PARALLEL_TOOL_CALLING_INSTRUCTION } from "./editFile";

export interface SingleFindAndReplaceArgs {
  filepath: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export const singleFindAndReplaceTool: Tool = {
  type: "function",
  displayTitle: "Find and Replace",
  wouldLikeTo: "edit {{{ filepath }}}",
  isCurrently: "editing {{{ filepath }}}",
  hasAlready: "edited {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: false,
  function: {
    name: BuiltInToolNames.SingleFindAndReplace,
    description: `Performs exact string replacements in a file.

IMPORTANT:
- ALWAYS use the \`${BuiltInToolNames.ReadFile}\` tool just before making edits, to understand the file's up-to-date contents and context. The user can also edit the file while you are working with it.
- You MUST call one and only one tol at a time. Even if you need to use multiple tools, then call them one by one. Only after success or failure of current tool is confirmed., you cam call the next tool. Also call the tool with sinagle change at a time and do not club multiple changes in a single tool call.   
- ${NO_PARALLEL_TOOL_CALLING_INSTRUCTION}
- When editing text from \`${BuiltInToolNames.ReadFile}\` tool output, ensure you preserve exact whitespace/indentation. if the tool output is enclosed as the quoted and escaped multiline string the remove the quotes and unescape the contents. Do NOT wrap in any code or MUST NOT provide any explaination.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable, for instance.
- Use \`fileUri\' uri to the file.
- Use \'baseName\` for the base name of the file.
- Use \'editingFileContents\' is an optional parameter. if this parameter is provided then you MUST provide the complete contents of the file in \`editingFileContents\` parameter. If you do not provide this parameter, then tool will read the file from disk. However, if you have recently read the file using \'${BuiltInToolNames.ReadFile}\' tool, it is recommended to provide the COMPLETE contents here to ensure consistency.



WARNINGS:
- When not using \`replace_all\`, the edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`.
- The edit will likely fail if you have not recently used the \`${BuiltInToolNames.ReadFile}\` tool to view up-to-date file contents.`,
    parameters: {
      type: "object",
      required: ["filepath", "old_string", "new_string"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path to the file to modify, relative to the root of the workspace (file URIs and absolute paths are also accepted)",
        },
        old_string: {
          type: "string",
          description:
            "The text to replace - must be exact including whitespace/indentation",
        },
        new_string: {
          type: "string",
          description:
            "The text to replace it with (MUST be different from old_string). Do NOT generate a quoted, escaped string as an output UNLESS the old_string is a quoted, escaped string. The new_string must contain only the string replacing old_string and must not contain any other explaination or status message.",
        },
        replace_all: {
          type: "boolean",
          description: "Replace all occurrences of old_string (default false)",
        },
        fileUri: {
          type: "string",
          description:
            "The file Uri of the file to modify, if available. If both the filepath and fileUri are provided, fileUri will be used.",
        },
        baseName: {
          type: "string",
          description: "The base name of file to modify, if available.",
        },
        editingFileContents: {
          type: "string",
          description:
            "This is an optional parameter. In case this parameter is provided then you MUST provide COMPLETE contents of the file. Otherwise tool will load current contents from the disk.",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To perform exact string replacements in files, use the ${BuiltInToolNames.SingleFindAndReplace} tool with a filepath (relative to the root of the workspace) and the strings to find and replace.

  For example, you could respond with:`,
    exampleArgs: [
      ["filepath", "path/to/file.ts"],
      ["old_string", "const oldVariable = 'value'"],
      ["new_string", "const newVariable = 'updated'"],
      ["replace_all", "false"],
      ["fileUri", "file:///path/to/file.ts"],
      ["baseName", "file.ts"],
      ["editingFileContents", "//file contents of file.ts"],
    ],
  },
  defaultToolPolicy: "allowedWithPermission",
};
