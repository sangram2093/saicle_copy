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
      required: ["summary"],
      properties: {
        summary: {
          type: "string",
          description:
            "Summary text of the regulation (e.g., from summarize_pdf).",
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
      },
    },
  },
};
