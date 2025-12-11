import { AllMediaTypes, ModelProvider } from "../types.js";

export const DbLLM: ModelProvider = {
  models: [
    {
      model: "dbllm",
      displayName: "DB LLM",
      contextLength: 2097152,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /dbllm/i,
      recommendedFor: ["chat"],
    },
  ],
  id: "dbllm",
  displayName: "DbLLM",
};
