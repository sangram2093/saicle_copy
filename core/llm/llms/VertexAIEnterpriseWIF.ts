import fetch, { Response as NodeFetchResponse } from "node-fetch";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";
import { adaptiveStreamWithCompaction } from "./adaptiveRetry.js";
import Gemini from "./Gemini.js";
import { getAgent } from "./VertexAIEnterprise.js";

const fs = require("fs");
const path = require("path");

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const STS_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:token-exchange";
const REQUESTED_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

interface WIFCredentialSource {
  file: string;
  format?: {
    type?: string;
  };
}

interface WIFConfig {
  universe_domain?: string;
  type: string;
  audience: string;
  subject_token_type: string;
  token_url: string;
  credential_source: WIFCredentialSource;
  service_account_impersonation_url?: string;
}

class VertexAIEnterpriseWIF extends BaseLLM {
  static providerName = "vertexai_enterprise_wif";
  declare apiBase: string;
  declare vertexProvider: "gemini" | "unknown";

  declare geminiInstance: Gemini;
  declare region: string;
  declare projectId: string;
  declare model: string;
  declare wif_json_path: string;

  private wifConfig: WIFConfig;
  private subjectTokenFilePath: string;
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

    if (_options.region !== "us-central1") {
      _options.maxEmbeddingBatchSize = Math.min(
        _options.maxEmbeddingBatchSize ?? 5,
        5,
      );
    }

    super(_options);

    if (!_options.region) {
      throw new Error("region is required but not provided");
    }
    this.region = _options.region;

    if (!_options.projectId) {
      throw new Error("projectId is required but not provided");
    }
    this.projectId = _options.projectId;

    if (!_options.model) {
      throw new Error("model is required but not provided");
    }
    this.model = _options.model;

    if (!_options.wif_json_path) {
      throw new Error("wif_json_path is required but not provided");
    }
    this.wif_json_path = _options.wif_json_path;

    const { config, subjectTokenFilePath } = this.loadWifConfig(
      this.wif_json_path,
    );
    this.wifConfig = config;
    this.subjectTokenFilePath = subjectTokenFilePath;

    this.vertexProvider = this.model.includes("gemini") ? "gemini" : "unknown";
    this.geminiInstance = new Gemini(_options);
  }

  private loadWifConfig(configPath: string): {
    config: WIFConfig;
    subjectTokenFilePath: string;
  } {
    const resolvedConfigPath = path.resolve(configPath);
    if (!fs.existsSync(resolvedConfigPath)) {
      throw new Error(
        `VertexAIEnterpriseWIF: WIF JSON file not found at ${resolvedConfigPath}`,
      );
    }

    let parsedConfig: WIFConfig;
    try {
      parsedConfig = JSON.parse(fs.readFileSync(resolvedConfigPath, "utf8"));
    } catch (error) {
      throw new Error("VertexAIEnterpriseWIF: Failed to parse WIF JSON file");
    }

    if (parsedConfig.type !== "external_account") {
      throw new Error(
        "VertexAIEnterpriseWIF: WIF JSON must have type 'external_account'",
      );
    }

    if (!parsedConfig.token_url) {
      throw new Error(
        "VertexAIEnterpriseWIF: token_url is missing in WIF JSON",
      );
    }

    if (!parsedConfig.subject_token_type) {
      throw new Error(
        "VertexAIEnterpriseWIF: subject_token_type is missing in WIF JSON",
      );
    }

    if (!parsedConfig.audience) {
      throw new Error("VertexAIEnterpriseWIF: audience is missing in WIF JSON");
    }

    if (!parsedConfig.credential_source?.file) {
      throw new Error(
        "VertexAIEnterpriseWIF: credential_source.file is missing in WIF JSON",
      );
    }

    const formatType = parsedConfig.credential_source?.format?.type;
    if (formatType && formatType !== "text") {
      throw new Error(
        `VertexAIEnterpriseWIF: Unsupported credential_source.format.type '${formatType}', expected 'text'`,
      );
    }

    const subjectTokenFilePath = path.isAbsolute(
      parsedConfig.credential_source.file,
    )
      ? parsedConfig.credential_source.file
      : path.resolve(
          path.dirname(resolvedConfigPath),
          parsedConfig.credential_source.file,
        );

    if (!fs.existsSync(subjectTokenFilePath)) {
      throw new Error(
        `VertexAIEnterpriseWIF: Subject token file not found at ${subjectTokenFilePath}`,
      );
    }

    return {
      config: parsedConfig,
      subjectTokenFilePath,
    };
  }

  private async generateGoogleAuthToken(): Promise<string> {
    try {
      const now = Math.floor(Date.now() / 1000);
      if (this.tokenCache && this.tokenCache.expiresAt > now) {
        return this.tokenCache.token;
      }

      const subjectToken = fs
        .readFileSync(this.subjectTokenFilePath, "utf8")
        .trim();
      if (!subjectToken) {
        throw new Error(
          "VertexAIEnterpriseWIF: Subject token file is empty or contains only whitespace",
        );
      }

      const { apiUrl, agent } = getAgent(this.wifConfig.token_url);
      const tokenResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: STS_GRANT_TYPE,
          subject_token_type: this.wifConfig.subject_token_type,
          subject_token: subjectToken,
          audience: this.wifConfig.audience,
          scope: CLOUD_PLATFORM_SCOPE,
          requested_token_type: REQUESTED_TOKEN_TYPE,
        }),
        agent,
      });

      if (!tokenResponse.ok) {
        throw new Error(
          `VertexAIEnterpriseWIF: STS token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText}`,
        );
      }

      const tokenData: any = await tokenResponse.json();
      const stsAccessToken: string | undefined = tokenData.access_token;
      const expiresIn: number | undefined = tokenData.expires_in;

      if (!stsAccessToken) {
        throw new Error(
          "VertexAIEnterpriseWIF: STS response missing access_token",
        );
      }

      let finalToken = stsAccessToken;
      let expiresAt =
        expiresIn && Number.isFinite(expiresIn)
          ? now + Number(expiresIn) - 60
          : now + 3600 - 60;

      if (this.wifConfig.service_account_impersonation_url) {
        const impersonation =
          await this.exchangeViaServiceAccount(stsAccessToken);
        finalToken = impersonation.token;
        expiresAt = impersonation.expiresAt;
      }

      this.tokenCache = {
        token: finalToken,
        expiresAt,
      };

      return finalToken;
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `Failed to generate Google Auth token via WIF: ${error.message}`,
        );
      } else {
        console.error(
          `Failed to generate Google Auth token via WIF: ${String(error)}`,
        );
      }
      throw error;
    }
  }

  private async exchangeViaServiceAccount(
    stsAccessToken: string,
  ): Promise<{ token: string; expiresAt: number }> {
    const impersonationUrl = this.wifConfig.service_account_impersonation_url;
    if (!impersonationUrl) {
      throw new Error(
        "VertexAIEnterpriseWIF: service_account_impersonation_url is missing",
      );
    }

    const { apiUrl, agent } = getAgent(impersonationUrl);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${stsAccessToken}`,
      },
      body: JSON.stringify({
        scope: [CLOUD_PLATFORM_SCOPE],
      }),
      agent,
    });

    if (!response.ok) {
      throw new Error(
        `VertexAIEnterpriseWIF: Service account impersonation failed: ${response.status} ${response.statusText}`,
      );
    }

    const data: any = await response.json();
    const accessToken: string | undefined = data.accessToken;
    const expireTime: string | undefined = data.expireTime;

    if (!accessToken || !expireTime) {
      throw new Error(
        "VertexAIEnterpriseWIF: Impersonation response missing accessToken or expireTime",
      );
    }

    const expiresAtMs = Date.parse(expireTime);
    if (Number.isNaN(expiresAtMs)) {
      throw new Error(
        "VertexAIEnterpriseWIF: Invalid expireTime returned from impersonation response",
      );
    }

    return {
      token: accessToken,
      expiresAt: Math.floor(expiresAtMs / 1000) - 60,
    };
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
      console.log("Posted JSON:", body ? JSON.stringify(body) : "");
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

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
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

export default VertexAIEnterpriseWIF;
