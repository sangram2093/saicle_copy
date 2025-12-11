import { JSONSchema7Object } from "json-schema";
import { Tool } from "../..";

// https://ai.google.dev/api/generate-content
export interface DbLLMGenerationConfig {
  stopSequences?: string[];
  responseMimeType?: string;
  candidateCount?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseLogprobs?: boolean;
  logprobs?: number;
  email?: string; // For DBLLM
  dbllm_apikey?: string; // For DBLLM
  kannon_id?: string; // For DBLLM
  dbllm_urlendpoint?: string; // For DBLLM
  data_classification?: string; // For DBLLM
  // responseSchema?: object; // https://ai.google.dev/api/caching#Schema
}

export type DbLLMObjectSchemaType =
  | "TYPE_UNSPECIFIED"
  | "STRING"
  | "NUMBER"
  | "INTEGER"
  | "BOOLEAN"
  | "ARRAY"
  | "OBJECT";

export interface DbLLMObjectSchema {
  type: DbLLMObjectSchemaType;
  format?: string;
  title?: string;
  description?: string;
  nullable?: boolean;
  enum?: string[];
  maxItems?: string;
  minItems?: string;
  properties?: Record<string, DbLLMObjectSchema>;
  required?: string[];
  anyOf?: DbLLMObjectSchema[];
  propertyOrdering?: string[];
  items?: DbLLMObjectSchema;
  minimum?: number;
  maximum?: number;
}

const jsonSchemaTypeToDbLLMType = (
  jsonSchemaType: string,
): DbLLMObjectSchemaType => {
  switch (jsonSchemaType.toLowerCase()) {
    case "string":
      return "STRING";
    case "object":
      return "OBJECT";
    case "number":
      return "NUMBER";
    case "integer":
      return "INTEGER";
    case "array":
      return "ARRAY";
    case "boolean":
      return "BOOLEAN";
    default:
      return "TYPE_UNSPECIFIED";
  }
};

function convertJsonSchemaToDbLLMSchema(jsonSchema: any): DbLLMObjectSchema {
  const jsonSchemaType = jsonSchema["type"];
  if (!jsonSchemaType || typeof jsonSchema.type !== "string") {
    throw new Error(
      `Invalid type property in function declaration\n${JSON.stringify(jsonSchema, null, 2)}`,
    );
  }
  const DbLLMSchema: DbLLMObjectSchema = {
    type: jsonSchemaTypeToDbLLMType(jsonSchemaType),
  };

  // if (jsonSchema.format) DbLLMSchema.format = jsonSchema.format;
  if (jsonSchema.title) DbLLMSchema.title = jsonSchema.title;
  if (jsonSchema.description) DbLLMSchema.description = jsonSchema.description;

  // Handle nullable
  if (jsonSchemaType === "null" || jsonSchema.nullable) {
    DbLLMSchema.nullable = true;
  }

  // Handle enum values
  if (Array.isArray(jsonSchema.enum)) {
    DbLLMSchema.enum = jsonSchema.enum.map(String);
  }

  // Handle array constraints
  if (jsonSchemaType === "array") {
    if (typeof jsonSchema.maxItems !== "undefined") {
      DbLLMSchema.maxItems = String(jsonSchema.maxItems);
    }
    if (typeof jsonSchema.minItems !== "undefined") {
      DbLLMSchema.minItems = String(jsonSchema.minItems);
    }
    // Handle array items
    if (jsonSchema.items) {
      DbLLMSchema.items = convertJsonSchemaToDbLLMSchema(jsonSchema.items);
    }
  }

  // Handle numeric constraints
  if (typeof jsonSchema.minimum !== "undefined") {
    DbLLMSchema.minimum = Number(jsonSchema.minimum);
  }
  if (typeof jsonSchema.maximum !== "undefined") {
    DbLLMSchema.maximum = Number(jsonSchema.maximum);
  }

  // Handle properties for objects
  if (jsonSchema.properties) {
    DbLLMSchema.properties = {};
    for (const [key, value] of Object.entries(jsonSchema.properties)) {
      DbLLMSchema.properties[key] = convertJsonSchemaToDbLLMSchema(value);
    }
  }

  // Handle required properties
  if (Array.isArray(jsonSchema.required)) {
    DbLLMSchema.required = jsonSchema.required;
  }

  // Handle anyOf
  if (Array.isArray(jsonSchema.anyOf)) {
    DbLLMSchema.anyOf = jsonSchema.anyOf.map(convertJsonSchemaToDbLLMSchema);
  }

  // TODO/UNSUPPORTED:
  // format
  // property ordering:
  // if (Array.isArray(jsonSchema.propertyOrdering)) {
  //   DbLLMSchema.propertyOrdering = jsonSchema.propertyOrdering;
  // }

  return DbLLMSchema;
}

// https://ai.google.dev/api/caching#FunctionDeclaration
// Note "reponse" field (schema showing function output structure) is not supported at the moment
export function convertDbSaicleToolToDbLLMFunction(
  tool: Tool,
): DbLLMToolFunctionDeclaration {
  if (!tool.function.name) {
    throw new Error("Function name required");
  }
  const description = tool.function.description ?? "";
  const name = tool.function.name;

  const fn: DbLLMToolFunctionDeclaration = {
    description,
    name,
  };

  if (
    tool.function.parameters &&
    "type" in tool.function.parameters &&
    typeof tool.function.parameters.type === "string"
  ) {
    // DbLLM can't take an empty object
    // So if empty object param is present just don't add parameters
    if (tool.function.parameters.type === "object") {
      if (JSON.stringify(tool.function.parameters.properties) === "{}") {
        return fn;
      }
    }

    fn.parameters = convertJsonSchemaToDbLLMSchema(tool.function.parameters);
  }

  return fn;
}

export type DbLLMTextContentPart = {
  text: string;
};

export type DbLLMInlineDataContentPart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

export type DbLLMFunctionCallContentPart = {
  functionCall: {
    id?: string;
    name: string;
    args: JSONSchema7Object;
  };
};

export type DbLLMFunctionResponseContentPart = {
  functionResponse: {
    id?: string;
    name: string;
    response: JSONSchema7Object;
  };
};

export type DbLLMFileDataContentPart = {
  fileData: {
    fileUri: string;
    mimeType: string; // See possible values here: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference#filedata
  };
};

export type DbLLMExecutableCodeContentPart = {
  executableCode: {
    language: "PYTHON" | "LANGUAGE_UNSPECIFIED";
    code: string;
  };
};

export type DbLLMCodeExecutionResultContentPart = {
  codeExecutionResult: {
    outcome:
      | "OUTCOME_UNSPECIFIED"
      | "OUTCOME_OK"
      | "OUTCOME_FAILED"
      | "OUTCOME_DEADLINE_EXCEEDED";
    output: string;
  };
};

export type DbLLMChatContentPart =
  | DbLLMTextContentPart
  | DbLLMInlineDataContentPart
  | DbLLMFunctionCallContentPart
  | DbLLMFunctionResponseContentPart
  | DbLLMFileDataContentPart
  | DbLLMExecutableCodeContentPart
  | DbLLMCodeExecutionResultContentPart;

export interface DbLLMChatContent {
  role?: "user" | "model";
  parts: DbLLMChatContentPart[];
}

export interface DbLLMToolFunctionDeclaration {
  name: string;
  description: string;
  parameters?: DbLLMObjectSchema;
  response?: DbLLMObjectSchema;
}
export interface DbLLMTool {
  functionDeclarations?: DbLLMToolFunctionDeclaration[];
  googleSearchRetrieval?: {
    dynamicRetrievalConfig: {
      mode?: "MODE_DYNAMIC" | "MODE_UNSPECIFIED";
      dynamicThreshold?: number;
    };
  };
  codeExecution?: {};
}

export interface DbLLMToolConfig {
  functionCallingConfig?: {
    mode?: "NONE" | "ANY" | "AUTO";
    allowedFunctionNames?: string[];
  };
}

// https://ai.google.dev/api/generate-content#request-body
export interface DbLLMChatRequestBody {
  contents: DbLLMChatContent[];
  tools?: DbLLMTool[];
  toolConfig?: DbLLMToolConfig;
  systemInstruction?: DbLLMChatContent;
  generationConfig?: DbLLMGenerationConfig;
  apiKey?: string; // For DBLLM
  email?: string; // For DBLLM
  kannon_id?: string; // For DBLLM
  data_classification?: string; // For DBLLM
  // cachedContent?: string;
  message?: string; // For DBLLM
  bot_name?: string; // For DBLLM
  sid?: string; // For DBLLM
  query_count?: string; // For DBLLM
  params?: {}; // For DBLLM
  system_prompt?: string; // For DBLLM
}

export interface DbLLMChatResponseSuccess {
  candidates: Candidate[];
  promptFeedback?: PromptFeedback;
  usageMetadata?: UsageMetadata;
}

export interface DbLLMChatResponseError {
  error: {
    message: string;
  };
}

export type DbLLMChatResponse =
  | DbLLMChatResponseError
  | DbLLMChatResponseSuccess;

interface PromptFeedback {
  blockReason?: BlockReason;
  safetyRatings: SafetyRating[];
}

enum BlockReason {
  BLOCK_REASON_UNSPECIFIED = "BLOCK_REASON_UNSPECIFIED",
  SAFETY = "SAFETY",
  OTHER = "OTHER",
  BLOCKLIST = "BLOCKLIST",
  PROHIBITED_CONTENT = "PROHIBITED_CONTENT",
}

interface SafetyRating {
  harmCategory: HarmCategory;
  harmProbability: HarmProbability;
  blocked: boolean;
}

enum HarmCategory {
  HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED",
  HARM_CATEGORY_DEROGATORY = "HARM_CATEGORY_DEROGATORY",
  HARM_CATEGORY_TOXICITY = "HARM_CATEGORY_TOXICITY",
  HARM_CATEGORY_VIOLENCE = "HARM_CATEGORY_VIOLENCE",
  HARM_CATEGORY_SEXUAL = "HARM_CATEGORY_SEXUAL",
  HARM_CATEGORY_MEDICAL = "HARM_CATEGORY_MEDICAL",
  HARM_CATEGORY_DANGEROUS = "HARM_CATEGORY_DANGEROUS",
  HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT",
  HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH",
  HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT",
  HARM_CATEGORY_CIVIC_INTEGRITY = "HARM_CATEGORY_CIVIC_INTEGRITY",
}

enum HarmProbability {
  HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED",
  NEGLIGIBLE = "NEGLIGIBLE",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

interface UsageMetadata {
  promptTokenCount: number;
  cachedContentTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface Candidate {
  content: DbLLMChatContent;
  finishReason?: FinishReason;
  safetyRatings?: SafetyRating[];
  tokenCount?: number;
  groundingAttribution?: GroundingAttribution;
  groundingMetadata?: GroundingMetadata;
  avgLogprobs?: number;
  logprobs?: LogprobsResult;
  index?: number;
}

enum FinishReason {
  FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED",
  STOP = "STOP",
  MAX_TOKENS = "MAX_TOKENS",
  SAFETY = "SAFETY",
  RECITATION = "RECITATION",
  LANGUAGE = "LANGUAGE",
  OTHER = "OTHER",
  BLOCKLIST = "BLOCKLIST",
  PROHIBITED_CONTENT = "PROHIBITED_CONTENT",
  SPII = "SPII",
  MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL",
}

interface GroundingAttribution {
  attributionSourceId: AttributionSourceId;
  groundingSourceContent: string;
}

interface AttributionSourceId {
  groundingPassage?: GroundingPassageId;
  semanticRetrieverChunk?: SemanticRetrieverChunk;
}

interface GroundingPassageId {
  passageId: string;
  partIndex: number;
}

interface SemanticRetrieverChunk {
  source: string;
  chunk: string;
}

interface GroundingMetadata {
  groundingSupport?: GroundingSupport[];
  webSearchQueries?: string[];
  searchEntryPoint?: SearchEntryPoint;
  retrievalMetadata?: RetrievalMetadata;
}

interface SearchEntryPoint {
  renderedContent?: string;
  sdkBlob?: string;
}

interface RetrievalMetadata {
  googleSearchDynamicRetrievalScore?: number;
}

interface GroundingSupport {
  groundingChunkIndices: number[];
  confidenceScores: number[];
  segment: Segment;
}

interface Segment {
  partIndex: number;
  startIndex: number;
  endIndex: number;
  text: string;
}

interface LogprobsResult {
  topCandidates: TopCandidates[];
  chosenCandidates: Candidate[];
}

interface TopCandidates {
  candidates: Candidate[];
}
