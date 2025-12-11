import https from "https";
import fetch, { Response as NodeFetchResponse } from "node-fetch";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";
import { adaptiveStreamWithCompaction, logSlicer } from "./adaptiveRetry.js";
import Gemini from "./Gemini.js";

// DBLLM is a Rev1 of Gemini provided by DB for internal use.
// It requires additional fields in the request body and uses a specific endpoint.
// This class extends the Gemini class to accommodate these differences.
class DbLLMRev1 extends BaseLLM {
  static providerName = "dbllmrev1";
  static defaultOptions: Partial<LLMOptions> = {
    model: "gemini-2.5-pro",

    apiBase:
      "https://ml-core-dev-mlcore-app.istio-de-dcb.prod.hc.intranet.db.com/api/llm/process/raw",

    maxStopWords: 5,
    maxEmbeddingBatchSize: 100,
  };
  constructor(_options: LLMOptions) {
    super(_options);
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
    this.vertexProvider = "gemini";

    this.geminiInstance = new Gemini(_options);
  }

  declare apiBase: string;
  declare vertexProvider: "gemini" | "unknown";

  declare geminiInstance: Gemini;
  declare region: string;
  declare projectId: string;
  declare keyfile_json_path: string;

  public async *responseTextChunks(
    res: NodeFetchResponse,
    encoding: BufferEncoding = "utf-8",
  ): AsyncGenerator<string> {
    if (!res.body) {
      return;
    }
    const decoder = new TextDecoder(encoding);
    for await (const chunk of res.body as any as AsyncIterable<Buffer>) {
      yield decoder.decode(chunk, { stream: true });
    }
    const flush = decoder.decode();
    if (flush) {
      yield flush;
    }
  }
  //DbLLMRev1 specific fields
  private async *streamChatGemini(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    try {
      const geminiBody = this.geminiInstance.prepareBody(
        messages,
        options,
        false,
        false,
      );
      logSlicer(geminiBody ? JSON.stringify(geminiBody, null, 2) : "");
      const form = new URLSearchParams();
      form.set("apiKey", this.dbllm_apikey as string);
      form.set("kannon_id", this.kannon_id as string);

      form.set("message", JSON.stringify(geminiBody));

      const headers = {
        accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      };
      const devurl =
        "https://ml-core-dev-mlcore-app.istio-de-dcb.prod.hc.intranet.db.com/api/llm/process/raw";
      const url = `${this.dbllm_urlendpoint ? (this.dbllm_urlendpoint as string) : devurl}?model=${encodeURIComponent(
        options.model || this.model || "gemini-2.5-pro",
      )}&email=${encodeURIComponent(this.email as string)}&data_classification=${encodeURIComponent(
        this.data_classification || "For Internal Use Only",
      )}`;

      const agent = new https.Agent({ rejectUnauthorized: false });

      console.log("DBLLMRev1 Request URL:", url);
      console.log(
        "DBLLMRev1 Request form payload keys:",
        Array.from(form.keys()),
      );
      const response = await fetch(url, {
        method: "POST",

        headers: headers,
        body: form.toString(),
        agent: agent,
      });

      for await (const message of this.geminiInstance.processGeminiResponse(
        this.responseTextChunks(response),
      )) {
        yield message;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `Failed to stream chat from DbLLMRev1:, ${error.message}`,
        );
      } else {
        console.error(
          `Failed to stream chat from DbLLMRev1:, ${String(error)}`,
        );
      }
      throw error;
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    // prepare initial messages (system merged if needed)
    const baseMessages = this.geminiInstance.removeSystemMessage(messages);

    if (this.vertexProvider !== "gemini") {
      throw new Error(`Unsupported model: ${options.model}`);
    }

    const isToolMode = !!(options.tools && options.tools.length > 0);
    options.maxTokensCeiling = options.maxTokensCeiling ?? 65536;

    if (isToolMode) {
      options.maxTokens = options.maxTokensCeiling;
      options.autoExpandMaxTokens = false;
      options.maxAutoTokenAttempts = 1;
    } else {
      options.autoExpandMaxTokens = options.autoExpandMaxTokens ?? true;
      options.maxAutoTokenAttempts = options.maxAutoTokenAttempts ?? 4;
    }

    options.reasoning = options.reasoning ?? true;
    options.provideCompletedMsg = options.provideCompletedMsg ?? true;
    const enableAuto = options.autoExpandMaxTokens === true;
    const attemptsLimit = enableAuto
      ? Math.max(1, options.maxAutoTokenAttempts ?? 2)
      : 1;

    const streamFn = (
      msgs: ChatMessage[],
      streamingOptions: CompletionOptions,
    ) => this.streamChatGemini(msgs, streamingOptions);

    for await (const msg of adaptiveStreamWithCompaction({
      messages: baseMessages,
      signal,
      options,
      streamFn,
      config: {
        enableAuto,
        originalMaxTokens: options.maxTokens,
        attemptsLimit,
        maxTokensCeiling: options.maxTokensCeiling,
        retainLast: 8,
        summaryCharBudget: 4000,
        legendHeader:
          "Earlier turns (compressed: legend: U=User, A=Assistant, T=Tool, O=Other):",
        allowAttemptExtension: true,
      },
    })) {
      yield msg;
    }
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const message of this._streamChat(
      [{ content: prompt, role: "user" }],
      signal,
      options,
    )) {
      yield renderChatMessage(message);
    }
  }
}

export default DbLLMRev1;
