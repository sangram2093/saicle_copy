import { AllMediaTypes, ModelProvider } from "../types.js";

export const DbLLMRev1: ModelProvider = {
  models: [
    {
      model: "dbllmrev1",
      displayName: "DB LLM Rev1",
      contextLength: 2097152,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /dbllmrev1/i,
      recommendedFor: ["chat"],
    },
  ],
  id: "dbllmrev1",
  displayName: "DbLLM Rev1",
};
