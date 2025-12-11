import { GeminiChatRequestBody } from "./gemini-types";

// https://ai.google.dev/api/generate-content
export interface DbLLMRev1ChatRequestBody extends GeminiChatRequestBody {
  apiKey: string;
  email: string; // For DBLLM
  kannon_id: string; // For DBLLM
  urlendpoint: string; // For DBLLM
  data_classification?:
    | "For Internal Use Only"
    //  | "Confidential"
    //  | "Strictly Confidential"
    | "Public"; // For DBLLM
}
