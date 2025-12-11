import {
  getEnvNoProxyPatterns,
  getProxy,
  shouldBypassProxy,
} from "@dbsaicledev/fetch";
import { default as http, default as https } from "https";
import fetch, { Response as NodeFetchResponse } from "node-fetch";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";
import { adaptiveStreamWithCompaction, logSlicer } from "./adaptiveRetry.js";
const fs = require("fs");
const jwt = require("jsonwebtoken");

import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";

import Gemini from "./Gemini.js";

class VertexAIEnterprise extends BaseLLM {
  static providerName = "vertexai_enterprise";
  declare apiBase: string;
  declare vertexProvider: "gemini" | "unknown";

  declare geminiInstance: Gemini;
  declare region: string;
  declare projectId: string;
  declare keyfile_json_path: string;
  declare model: string;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  static defaultOptions: Partial<LLMOptions> | undefined = {
    maxEmbeddingBatchSize: 250,
    region: "us-central1",
    completionOptions: {
      maxTokens: 8192,
      maxAutoTokenAttempts: 4,
      maxTokensCeiling: 65536,
      autoExpandMaxTokens: true,
    } as any,
  };

  constructor(_options: LLMOptions) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    super(_options);
    if (!_options.region) {
      throw new Error("region is required but not provided");
    }
    this.region = _options.region;
    if (!_options.projectId) {
      throw new Error("projectId is required but not provided");
    }
    this.projectId = _options.projectId;
    if (!_options.keyfile_json_path) {
      throw new Error("keyfile_json_path is required but not provided");
    }
    this.keyfile_json_path = _options.keyfile_json_path;

    if (!_options.model) {
      throw new Error("model is required but not provided");
    }
    this.model = _options.model;

    if (this.region !== "us-central1") {
      // Any region outside of us-central1 has a max batch size of 5.
      _options.maxEmbeddingBatchSize = Math.min(
        _options.maxEmbeddingBatchSize ?? 5,
        5,
      );
    }

    this.vertexProvider = this.model.includes("gemini") ? "gemini" : "unknown";

    this.geminiInstance = new Gemini(_options);
  }

  private async generateGoogleAuthToken(): Promise<string> {
    try {
      // check if the token is still valid
      const now = Math.floor(Date.now() / 1000);
      if (this.tokenCache && this.tokenCache.expiresAt > now) {
        return this.tokenCache.token;
      }
      if (!this.keyfile_json_path) {
        throw new Error("keyfile_json_path is required but not provided");
      }
      // step 1: Read the keyfile
      const keyfile = JSON.parse(
        fs.readFileSync(this.keyfile_json_path, "utf8"),
      );
      const { client_email, private_key } = keyfile;

      // step 2: create the JWT for the service account
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const jwtPayload = {
        iss: client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: "https://oauth2.googleapis.com/token",
        iat: nowInSeconds,
        exp: nowInSeconds + 3600, // 1 hour expiration
      };
      const signedJwt = jwt.sign(jwtPayload, private_key, {
        algorithm: "RS256",
      });
      // step 3: make http post request to Google's OAuth 2.0 token endpoint
      const tokenEndpoint = "https://oauth2.googleapis.com/token";
      const { apiUrl, agent } = getAgent(tokenEndpoint);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: signedJwt,
        }),
        agent: agent,
      });
      if (!response.ok) {
        throw new Error(
          `Failed to get access token: ${response.status} ${response.statusText}`,
        );
      }
      const tokenData = await response.json();
      //@ts-ignore
      const token = tokenData.access_token;
      //@ts-ignore
      const expiresIn = tokenData.expires_in;
      this.tokenCache = {
        token,
        expiresAt: now + expiresIn - 60, // subtract 60 seconds for safety
      };
      return token;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to generate Google Auth token: ${error.message}`);
      } else {
        console.error(`Failed to generate Google Auth token: ${String(error)}`);
      }
      throw error;
    }
  }

  public async *responseTextChunks(
    res: NodeFetchResponse,
    encoding: BufferEncoding = "utf-8",
  ): AsyncIterable<string> {
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
  // Gemini
  private async *streamChatGemini(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    try {
      const token = await this.generateGoogleAuthToken();
      const apiUrlStr = `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/google/models/${this.model}:streamGenerateContent`;
      const { apiUrl, agent } = getAgent(apiUrlStr);
      const body = this.geminiInstance.prepareBody(
        messages,
        options,
        false,
        false,
      );
      logSlicer(body ? JSON.stringify(body, null, 2) : "");

      const response = await fetch(apiUrl, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "model-builder/1.10.0 grpc-node/1.10.0",
        },
        body: JSON.stringify(body),
        agent: agent,
      });

      for await (const message of this.geminiInstance.processGeminiResponse(
        this.responseTextChunks(response),
      )) {
        yield message;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to stream chat from Gemini: ${error.message}`);
      } else {
        console.error(`Failed to stream chat from Gemini: ${String(error)}`);
      }
      throw error;
    }
  }
  // Manager functions

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

export function getAgent(apiUrlStr: string): {
  apiUrl: URL;
  agent: https.Agent | undefined;
} {
  const TIMEOUT = 7200; // 2 hrs  timeout
  const timeout = TIMEOUT * 1000; // convert to ms
  const apiUrl = new URL(apiUrlStr);
  if (apiUrl.host === "localhost") {
    apiUrl.host = "127.0.0.1";
  }

  const proxy = getProxy(apiUrl.protocol);

  const agentOptions: { [key: string]: any } = {
    keepAlive: true,
    sessionTimeout: timeout,
    keepAliveMsecs: timeout,
    rejectUnauthorized: false,
  };

  const shouldBypass = shouldBypassProxy(apiUrl.hostname, {
    verifySsl: false,
  });

  // create agent
  const protocol = apiUrl.protocol === "https:" ? https : http;

  const agent =
    proxy && !shouldBypass
      ? protocol === https
        ? new HttpsProxyAgent(proxy, agentOptions)
        : new HttpProxyAgent(proxy, agentOptions)
      : new protocol.Agent(agentOptions);
  if (proxy && !shouldBypass) {
    console.log(
      `Routing request to ${apiUrl.href} via proxy ${proxy}, while (no proxy patterns: ${getEnvNoProxyPatterns().join(", ")} )`,
    );
  } else if (proxy && shouldBypass) {
    console.log(
      `Bypassing proxy request to ${apiUrl.href} via proxy ${proxy} ,due to no proxy patterns: ${getEnvNoProxyPatterns().join(", ")}`,
    );
  }

  return { apiUrl, agent };
}
export default VertexAIEnterprise;
