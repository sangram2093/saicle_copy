import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getOptionalStringArg, getStringArg } from "../parseArgs";
import { runCompletion } from "./summarizePdfHelpers";
import { ENTITY_PROMPT, extractJsonBlob, DEFAULT_MAX_OUTPUT_TOKENS } from "./extractAuraHelpers";

type ExtractAuraEntitiesArgs = {
  summary: string;
  previousGraphJson?: string;
  model?: string;
  maxOutputTokens?: number;
};

export const extractAuraEntitiesImpl: ToolImpl = async (
  args: ExtractAuraEntitiesArgs,
  extras,
) => {
  const summary = getStringArg(args, "summary");
  const previousGraphJson = getOptionalStringArg(args, "previousGraphJson");
  const model = getOptionalStringArg(args, "model") || extras.llm.model;
  const maxTokens =
    typeof args.maxOutputTokens !== "undefined"
      ? Number(args.maxOutputTokens)
      : DEFAULT_MAX_OUTPUT_TOKENS;

  const raw = await runCompletion(
    extras.llm,
    ENTITY_PROMPT(summary, previousGraphJson),
    model,
    maxTokens,
  );

  const entitiesJson = extractJsonBlob(raw);

  const contextItems: ContextItem[] = [
    {
      name: "Aura Entities",
      description: "Entity/relationship JSON extracted from summary",
      content: `\`\`\`json\n${JSON.stringify(entitiesJson, null, 2)}\n\`\`\``,
    },
  ];

  return contextItems;
};
