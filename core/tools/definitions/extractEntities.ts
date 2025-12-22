import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const extractEntitiesTool: Tool = {
  type: "function",
  displayTitle: "Extract Entities",
  wouldLikeTo: "extract entities/relationships from chunked text using a provided prompt",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ExtractEntities,
    description:
      "Given chunked markdown and a user-provided prompt (or default), extract entity/relationship markdown (no JSON), merging across chunks to avoid duplicates.",
    parameters: {
      type: "object",
      required: ["markdown"],
      properties: {
        markdown: {
          type: "string",
          description: "Markdown containing chunked text (e.g., from parse_pdf).",
        },
        prompt: {
          type: "string",
          description:
            "Custom extraction prompt. If omitted, a default regulation-focused prompt is used.",
        },
        promptFilePath: {
          type: "string",
          description:
            "Optional path to a file containing the extraction prompt (workspace-relative or absolute).",
        },
        previousGraphMarkdown: {
          type: "string",
          description:
            "Optional previous graph markdown (entities/relationships) to bias diffs and re-use structure.",
        },
        model: {
          type: "string",
          description:
            "Model to use (defaults to the active/session model if omitted).",
        },
        maxOutputTokens: {
          type: "number",
          description:
            "Max tokens per LLM call (default MAX_OUTPUT_TOKENS env or 8192).",
        },
        chunkSizeChars: {
          type: "number",
          description:
            "Optional chunk size override if you need to re-chunk markdown text.",
        },
      },
    },
  },
};
