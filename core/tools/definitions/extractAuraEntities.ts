import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const extractAuraEntitiesTool: Tool = {
  type: "function",
  displayTitle: "Extract Aura Entities",
  wouldLikeTo: "extract entities/relationships from a summarized PDF",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ExtractAuraEntities,
    description:
      "Given a regulation summary, extract entity/relationship JSON using the Aura prompts.",
    parameters: {
      type: "object",
      required: ["markdown"],
      properties: {
        markdown: {
          type: "string",
          description: "Markdown containing chunked PDF text (from parse_pdf).",
        },
        previousGraphJson: {
          type: "string",
          description:
            "Optional previous graph JSON to bias diffs and re-use structure.",
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
