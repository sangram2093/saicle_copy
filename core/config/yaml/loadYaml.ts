import {
  AssistantUnrolled,
  BLOCK_TYPES,
  ConfigResult,
  ConfigValidationError,
  isAssistantUnrolledNonNullable,
  mergeUnrolledAssistants,
  ModelRole,
  PackageIdentifier,
  RegistryClient,
  TEMPLATE_VAR_REGEX,
  unrollAssistant,
  validateConfigYaml,
} from "@dbsaicledev/config-yaml";
import { dirname } from "node:path";

import { DbSaicleConfig, IDE, IdeInfo, IdeSettings, ILLMLogger } from "../..";
import { MCPManagerSingleton } from "../../context/mcp/MCPManagerSingleton";
import { ControlPlaneClient } from "../../control-plane/client";
import TransformersJsEmbeddingsProvider from "../../llm/llms/TransformersJsEmbeddingsProvider";
import { getAllPromptFiles } from "../../promptFiles/getPromptFiles";
import { GlobalContext } from "../../util/GlobalContext";
import { modifyAnyConfigWithSharedConfig } from "../sharedConfig";

import { convertPromptBlockToSlashCommand } from "../../commands/slash/promptBlockSlashCommand";
import { slashCommandFromPromptFile } from "../../commands/slash/promptFileSlashCommand";
import { convertRuleBlockToSlashCommand } from "../../commands/slash/ruleBlockSlashCommand";
import { getControlPlaneEnvSync } from "../../control-plane/env";
import { PolicySingleton } from "../../control-plane/PolicySingleton";
import { getBaseToolDefinitions } from "../../tools";
import { getCleanUriPath } from "../../util/uri";
import { loadConfigContextProviders } from "../loadContextProviders";
import { getAllDotDbSaicleDefinitionFiles } from "../loadLocalAssistants";
import { unrollLocalYamlBlocks } from "./loadLocalYamlBlocks";
import { LocalPlatformClient } from "./LocalPlatformClient";
import { llmsFromModelConfig } from "./models";
import {
  convertYamlMcpToDbSaicleMcp,
  convertYamlRuleToDbSaicleRule,
} from "./yamlToDbSaicleConfig";

// Helper: process rules and convert invokable ones to slash commands.
function processRulesIntoConfig(
  rules: Array<any>,
  dbsaicleConfig: DbSaicleConfig,
  localErrors: ConfigValidationError[],
) {
  for (const rule of rules) {
    const convertedRule = convertYamlRuleToDbSaicleRule(rule);
    // Ensure rule added to config rules if not already
    // (caller may have already pushed a converted rule)
    if (!dbsaicleConfig.rules.find((r) => r.name === convertedRule.name)) {
      dbsaicleConfig.rules.push(convertedRule);
    }

    if (convertedRule.invokable) {
      try {
        const slashCommand = convertRuleBlockToSlashCommand(convertedRule);
        dbsaicleConfig.slashCommands?.push(slashCommand);
      } catch (e) {
        localErrors.push({
          message: `Error converting invokable rule ${convertedRule.name} to slash command: ${e instanceof Error ? e.message : e}`,
          fatal: false,
        });
      }
    }
  }
}

async function loadConfigYaml(options: {
  overrideConfigYaml: AssistantUnrolled | undefined;
  controlPlaneClient: ControlPlaneClient;
  orgScopeId: string | null;
  ideSettings: IdeSettings;
  ide: IDE;
  packageIdentifier: PackageIdentifier;
}): Promise<ConfigResult<AssistantUnrolled>> {
  const {
    overrideConfigYaml,
    controlPlaneClient,
    orgScopeId,
    ideSettings,
    ide,
    packageIdentifier,
  } = options;

  // Add local .dbsaicle blocks
  const localBlockPromises = BLOCK_TYPES.map(async (blockType) => {
    const localBlocks = await getAllDotDbSaicleDefinitionFiles(
      ide,
      { includeGlobal: true, includeWorkspace: true, fileExtType: "yaml" },
      blockType,
    );
    return localBlocks.map((b) => ({
      uriType: "file" as const,
      fileUri: b.path,
    }));
  });
  const localPackageIdentifiers: PackageIdentifier[] = (
    await Promise.all(localBlockPromises)
  ).flat();

  // logger.info(
  //   `Loading config.yaml from ${JSON.stringify(packageIdentifier)} with root path ${rootPath}`,
  // );

  // Registry client is only used if local blocks are present, but logic same for hub/local assistants
  const getRegistryClient = async () => {
    const rootPath =
      packageIdentifier.uriType === "file"
        ? dirname(getCleanUriPath(packageIdentifier.fileUri))
        : undefined;
    return new RegistryClient({
      accessToken: await controlPlaneClient.getAccessToken(),
      apiBase: getControlPlaneEnvSync(ideSettings.dbsaicleTestEnvironment)
        .CONTROL_PLANE_URL,
      rootPath,
    });
  };

  const errors: ConfigValidationError[] = [];

  let config: AssistantUnrolled | undefined;

  if (overrideConfigYaml) {
    config = overrideConfigYaml;
    if (localPackageIdentifiers.length > 0) {
      const unrolledLocal = await unrollLocalYamlBlocks(
        localPackageIdentifiers,
        ide,
        await getRegistryClient(),
        orgScopeId,
        controlPlaneClient,
      );
      if (unrolledLocal.errors) {
        errors.push(...unrolledLocal.errors);
      }
      if (unrolledLocal.config) {
        config = mergeUnrolledAssistants(config, unrolledLocal.config);
      }
    }
  } else {
    // This is how we allow use of blocks locally
    const unrollResult = await unrollAssistant(
      packageIdentifier,
      await getRegistryClient(),
      {
        renderSecrets: true,
        currentUserSlug: "",
        onPremProxyUrl: null,
        orgScopeId,
        platformClient: new LocalPlatformClient(
          orgScopeId,
          controlPlaneClient,
          ide,
        ),
        injectBlocks: localPackageIdentifiers,
      },
    );
    config = unrollResult.config;
    if (unrollResult.errors) {
      errors.push(...unrollResult.errors);
    }
  }

  if (config && isAssistantUnrolledNonNullable(config)) {
    errors.push(...validateConfigYaml(config));
  }

  if (errors?.some((error) => error.fatal)) {
    return {
      errors,
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  // Set defaults if undefined (this lets us keep config.json uncluttered for new users)
  return {
    config,
    errors,
    configLoadInterrupted: false,
  };
}

async function configYamlToDbSaicleConfig(options: {
  config: AssistantUnrolled;
  ide: IDE;
  ideSettings: IdeSettings;
  ideInfo: IdeInfo;
  uniqueId: string;
  llmLogger: ILLMLogger;
  workOsAccessToken: string | undefined;
}): Promise<{ config: DbSaicleConfig; errors: ConfigValidationError[] }> {
  let { config, ide, ideSettings, ideInfo, uniqueId, llmLogger } = options;

  const localErrors: ConfigValidationError[] = [];

  const dbsaicleConfig: DbSaicleConfig = {
    slashCommands: [],
    tools: getBaseToolDefinitions(),
    mcpServerStatuses: [],
    contextProviders: [],
    modelsByRole: {
      chat: [],
      edit: [],
      apply: [],
      embed: [],
      autocomplete: [],
      rerank: [],
      summarize: [],
    },
    selectedModelByRole: {
      chat: null,
      edit: null, // not currently used
      apply: null,
      embed: null,
      autocomplete: null,
      rerank: null,
      summarize: null,
    },
    rules: [],
  };

  // Right now, if there are any missing packages in the config, then we will just throw an error
  if (!isAssistantUnrolledNonNullable(config)) {
    return {
      config: dbsaicleConfig,
      errors: [
        {
          message:
            "Failed to load config due to missing blocks, see which blocks are missing below",
          fatal: true,
        },
      ],
    };
  }

  for (const rule of config.rules ?? []) {
    // Will be processed by helper
    dbsaicleConfig.rules.push(convertYamlRuleToDbSaicleRule(rule));
  }

  // Process rules (convert invokable rules to slash commands) in a helper to reduce function complexity
  processRulesIntoConfig(config.rules ?? [], dbsaicleConfig, localErrors);

  dbsaicleConfig.data = config.data;
  dbsaicleConfig.docs = config.docs?.map((doc) => ({
    title: doc.name,
    startUrl: doc.startUrl,
    rootUrl: doc.rootUrl,
    faviconUrl: doc.faviconUrl,
    useLocalCrawling: doc.useLocalCrawling,
    sourceFile: doc.sourceFile,
  }));

  config.mcpServers?.forEach((mcpServer) => {
    const mcpArgVariables =
      mcpServer.args?.filter((arg) => TEMPLATE_VAR_REGEX.test(arg)) ?? [];

    if (mcpArgVariables.length === 0) {
      return;
    }

    localErrors.push({
      fatal: false,
      message: `MCP server "${mcpServer.name}" has unsubstituted variables in args: ${mcpArgVariables.join(", ")}. Please refer to https://docs.dbsaicle.dev/hub/secrets/secret-types for managing hub secrets.`,
    });
  });

  dbsaicleConfig.experimental = {
    modelContextProtocolServers: config.mcpServers?.map(
      convertYamlMcpToDbSaicleMcp,
    ),
  };

  // Prompt files -
  try {
    const promptFiles = await getAllPromptFiles(ide, undefined, true);

    promptFiles.forEach((file) => {
      try {
        const slashCommand = slashCommandFromPromptFile(
          file.path,
          file.content,
        );
        if (slashCommand) {
          dbsaicleConfig.slashCommands?.push(slashCommand);
        }
      } catch (e) {
        localErrors.push({
          fatal: false,
          message: `Failed to convert prompt file ${file.path} to slash command: ${e instanceof Error ? e.message : e}`,
        });
      }
    });
  } catch (e) {
    localErrors.push({
      fatal: false,
      message: `Error loading local prompt files: ${e instanceof Error ? e.message : e}`,
    });
  }

  config.prompts?.forEach((prompt) => {
    try {
      const slashCommand = convertPromptBlockToSlashCommand(prompt);
      dbsaicleConfig.slashCommands?.push(slashCommand);
    } catch (e) {
      localErrors.push({
        message: `Error loading prompt ${prompt.name}: ${e instanceof Error ? e.message : e}`,
        fatal: false,
      });
    }
  });

  // Models
  let warnAboutFreeTrial = false;
  const defaultModelRoles: ModelRole[] = ["chat", "summarize", "apply", "edit"];
  for (const model of config.models ?? []) {
    model.roles = model.roles ?? defaultModelRoles; // Default to all 4 chat-esque roles if not specified

    if (model.provider === "free-trial") {
      warnAboutFreeTrial = true;
    }
    try {
      const llms = await llmsFromModelConfig({
        model,
        ide,
        uniqueId,
        ideSettings,
        llmLogger,
        config: dbsaicleConfig,
      });

      if (model.roles?.includes("chat")) {
        dbsaicleConfig.modelsByRole.chat.push(...llms);
      }

      if (model.roles?.includes("summarize")) {
        dbsaicleConfig.modelsByRole.summarize.push(...llms);
      }

      if (model.roles?.includes("apply")) {
        dbsaicleConfig.modelsByRole.apply.push(...llms);
      }

      if (model.roles?.includes("edit")) {
        dbsaicleConfig.modelsByRole.edit.push(...llms);
      }

      if (model.roles?.includes("autocomplete")) {
        dbsaicleConfig.modelsByRole.autocomplete.push(...llms);
      }

      if (model.roles?.includes("embed")) {
        const { provider } = model;
        if (provider === "transformers.js") {
          if (ideInfo.ideType === "vscode") {
            dbsaicleConfig.modelsByRole.embed.push(
              new TransformersJsEmbeddingsProvider(),
            );
          } else {
            localErrors.push({
              fatal: false,
              message: `Transformers.js embeddings provider not supported in this IDE.`,
            });
          }
        } else {
          dbsaicleConfig.modelsByRole.embed.push(...llms);
        }
      }

      if (model.roles?.includes("rerank")) {
        dbsaicleConfig.modelsByRole.rerank.push(...llms);
      }
    } catch (e) {
      localErrors.push({
        fatal: false,
        message: `Failed to load model:\nName: ${model.name}\nModel: ${model.model}\nProvider: ${model.provider}\n${e instanceof Error ? e.message : e}`,
      });
    }
  }

  // Add transformers js to the embed models in vs code if not already added
  if (
    ideInfo.ideType === "vscode" &&
    !dbsaicleConfig.modelsByRole.embed.find(
      (m) => m.providerName === "transformers.js",
    )
  ) {
    dbsaicleConfig.modelsByRole.embed.push(
      new TransformersJsEmbeddingsProvider(),
    );
  }

  if (warnAboutFreeTrial) {
    localErrors.push({
      fatal: false,
      message:
        "Model provider 'free-trial' is no longer supported, will be ignored.",
    });
  }

  const { providers, errors: contextErrors } = loadConfigContextProviders(
    config.context,
    !!config.docs?.length,
    ideInfo.ideType,
  );

  dbsaicleConfig.contextProviders = providers;
  localErrors.push(...contextErrors);

  // Extract optional Jira configuration from the unrolled YAML and attach to the runtime config
  extractJiraConfigInFlow(config, dbsaicleConfig, localErrors);
  // Extract optional confluence configuration from the unrolled YAML and attach to the runtime config
  extractConfluenceConfigInFlow(config, dbsaicleConfig, localErrors);
  // Extract optional ServiceNow configuration from the unrolled YAML and attach to the runtime config
  extractServiceNowConfigInFlow(config, dbsaicleConfig, localErrors);
  // Trigger MCP server refreshes (Config is reloaded again once connected!)
  const mcpManager = MCPManagerSingleton.getInstance();
  const orgPolicy = PolicySingleton.getInstance().policy;
  if (orgPolicy?.policy?.allowMcpServers === false) {
    await mcpManager.shutdown();
  } else {
    mcpManager.setConnections(
      (config.mcpServers ?? []).map((server) => ({
        id: server.name,
        name: server.name,
        sourceFile: server.sourceFile,
        transport: {
          type: "stdio",
          args: [],
          ...(server as any), // TODO: fix the types on mcpServers in config-yaml
        },
        timeout: server.connectionTimeout,
      })),
      false,
      { ide },
    );
  }

  return { config: dbsaicleConfig, errors: localErrors };
}

function extractJiraConfigInFlow(
  config: {
    name: string;
    version: string;
    env?: Record<string, string | number | boolean> | undefined;
    schema?: string | undefined;
    rules?:
      | (
          | string
          | {
              name: string;
              rule: string;
              regex?: string | string[] | undefined;
              sourceFile?: string | undefined;
              description?: string | undefined;
              globs?: string | string[] | undefined;
              alwaysApply?: boolean | undefined;
              invokable?: boolean | undefined;
            }
        )[]
      | undefined;
    context?:
      | { provider: string; params?: any; name?: string | undefined }[]
      | undefined;
    metadata?:
      | (Record<string, string> & {
          description?: string | undefined;
          author?: string | undefined;
          license?: string | undefined;
          tags?: string | undefined;
          sourceCodeUrl?: string | undefined;
          iconUrl?: string | undefined;
        })
      | undefined;
    jira?: { domain: string; apiToken: string; authEmail: string } | undefined;
    confluence?:
      | { apiToken: string; confluenceBaseUrl: string; userEmail: string }
      | undefined;
    models?:
      | (
          | {
              provider: "dbsaicle-proxy";
              orgScopeId: string | null;
              onPremProxyUrl: string | null;
              name: string;
              model: string;
              apiKeyLocation?: string | undefined;
              envSecretLocations?: Record<string, string> | undefined;
              apiKey?: string | undefined;
              apiBase?: string | undefined;
              maxStopWords?: number | undefined;
              roles?:
                | (
                    | "chat"
                    | "autocomplete"
                    | "embed"
                    | "rerank"
                    | "edit"
                    | "apply"
                    | "summarize"
                  )[]
                | undefined;
              capabilities?: string[] | undefined;
              defaultCompletionOptions?:
                | {
                    contextLength?: number | undefined;
                    maxTokens?: number | undefined;
                    temperature?: number | undefined;
                    topP?: number | undefined;
                    topK?: number | undefined;
                    minP?: number | undefined;
                    presencePenalty?: number | undefined;
                    frequencyPenalty?: number | undefined;
                    stop?: string[] | undefined;
                    n?: number | undefined;
                    reasoning?: boolean | undefined;
                    reasoningBudgetTokens?: number | undefined;
                    promptCaching?: boolean | undefined;
                    stream?: boolean | undefined;
                  }
                | undefined;
              cacheBehavior?:
                | {
                    cacheSystemMessage?: boolean | undefined;
                    cacheConversation?: boolean | undefined;
                  }
                | undefined;
              requestOptions?:
                | {
                    timeout?: number | undefined;
                    verifySsl?: boolean | undefined;
                    caBundlePath?: string | string[] | undefined;
                    proxy?: string | undefined;
                    headers?: Record<string, string> | undefined;
                    extraBodyProperties?: Record<string, any> | undefined;
                    noProxy?: string[] | undefined;
                    clientCertificate?:
                      | {
                          cert: string;
                          key: string;
                          passphrase?: string | undefined;
                        }
                      | undefined;
                  }
                | undefined;
              embedOptions?:
                | {
                    maxChunkSize?: number | undefined;
                    maxBatchSize?: number | undefined;
                    embeddingPrefixes?:
                      | Partial<Record<"chunk" | "query", string>>
                      | undefined;
                  }
                | undefined;
              chatOptions?:
                | {
                    baseSystemMessage?: string | undefined;
                    baseAgentSystemMessage?: string | undefined;
                    basePlanSystemMessage?: string | undefined;
                  }
                | undefined;
              promptTemplates?:
                | {
                    chat?:
                      | "llama2"
                      | "alpaca"
                      | "zephyr"
                      | "phi2"
                      | "phind"
                      | "anthropic"
                      | "chatml"
                      | "none"
                      | "openchat"
                      | "deepseek"
                      | "xwin-coder"
                      | "neural-chat"
                      | "codellama-70b"
                      | "llava"
                      | "gemma"
                      | "granite"
                      | "llama3"
                      | "codestral"
                      | undefined;
                    autocomplete?: string | undefined;
                    edit?: string | undefined;
                    apply?: string | undefined;
                  }
                | undefined;
              useLegacyCompletionsEndpoint?: boolean | undefined;
              env?: Record<string, string | number | boolean> | undefined;
              autocompleteOptions?:
                | {
                    disable?: boolean | undefined;
                    maxPromptTokens?: number | undefined;
                    debounceDelay?: number | undefined;
                    modelTimeout?: number | undefined;
                    maxSuffixPercentage?: number | undefined;
                    prefixPercentage?: number | undefined;
                    transform?: boolean | undefined;
                    template?: string | undefined;
                    onlyMyCode?: boolean | undefined;
                    useCache?: boolean | undefined;
                    useImports?: boolean | undefined;
                    useRecentlyEdited?: boolean | undefined;
                    useRecentlyOpened?: boolean | undefined;
                    experimental_includeClipboard?: boolean | undefined;
                    experimental_includeRecentlyVisitedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeRecentlyEditedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeDiff?: boolean | undefined;
                    experimental_enableStaticContextualization?:
                      | boolean
                      | undefined;
                  }
                | undefined;
            }
          | {
              provider: string;
              name: string;
              model: string;
              email?: string | undefined;
              apiKey?: string | undefined;
              apiBase?: string | undefined;
              maxStopWords?: number | undefined;
              roles?:
                | (
                    | "chat"
                    | "autocomplete"
                    | "embed"
                    | "rerank"
                    | "edit"
                    | "apply"
                    | "summarize"
                  )[]
                | undefined;
              capabilities?: string[] | undefined;
              defaultCompletionOptions?:
                | {
                    contextLength?: number | undefined;
                    maxTokens?: number | undefined;
                    temperature?: number | undefined;
                    topP?: number | undefined;
                    topK?: number | undefined;
                    minP?: number | undefined;
                    presencePenalty?: number | undefined;
                    frequencyPenalty?: number | undefined;
                    stop?: string[] | undefined;
                    n?: number | undefined;
                    reasoning?: boolean | undefined;
                    reasoningBudgetTokens?: number | undefined;
                    promptCaching?: boolean | undefined;
                    stream?: boolean | undefined;
                  }
                | undefined;
              cacheBehavior?:
                | {
                    cacheSystemMessage?: boolean | undefined;
                    cacheConversation?: boolean | undefined;
                  }
                | undefined;
              requestOptions?:
                | {
                    timeout?: number | undefined;
                    verifySsl?: boolean | undefined;
                    caBundlePath?: string | string[] | undefined;
                    proxy?: string | undefined;
                    headers?: Record<string, string> | undefined;
                    extraBodyProperties?: Record<string, any> | undefined;
                    noProxy?: string[] | undefined;
                    clientCertificate?:
                      | {
                          cert: string;
                          key: string;
                          passphrase?: string | undefined;
                        }
                      | undefined;
                  }
                | undefined;
              embedOptions?:
                | {
                    maxChunkSize?: number | undefined;
                    maxBatchSize?: number | undefined;
                    embeddingPrefixes?:
                      | Partial<Record<"chunk" | "query", string>>
                      | undefined;
                  }
                | undefined;
              chatOptions?:
                | {
                    baseSystemMessage?: string | undefined;
                    baseAgentSystemMessage?: string | undefined;
                    basePlanSystemMessage?: string | undefined;
                  }
                | undefined;
              promptTemplates?:
                | {
                    chat?:
                      | "llama2"
                      | "alpaca"
                      | "zephyr"
                      | "phi2"
                      | "phind"
                      | "anthropic"
                      | "chatml"
                      | "none"
                      | "openchat"
                      | "deepseek"
                      | "xwin-coder"
                      | "neural-chat"
                      | "codellama-70b"
                      | "llava"
                      | "gemma"
                      | "granite"
                      | "llama3"
                      | "codestral"
                      | undefined;
                    autocomplete?: string | undefined;
                    edit?: string | undefined;
                    apply?: string | undefined;
                  }
                | undefined;
              useLegacyCompletionsEndpoint?: boolean | undefined;
              env?: Record<string, string | number | boolean> | undefined;
              autocompleteOptions?:
                | {
                    disable?: boolean | undefined;
                    maxPromptTokens?: number | undefined;
                    debounceDelay?: number | undefined;
                    modelTimeout?: number | undefined;
                    maxSuffixPercentage?: number | undefined;
                    prefixPercentage?: number | undefined;
                    transform?: boolean | undefined;
                    template?: string | undefined;
                    onlyMyCode?: boolean | undefined;
                    useCache?: boolean | undefined;
                    useImports?: boolean | undefined;
                    useRecentlyEdited?: boolean | undefined;
                    useRecentlyOpened?: boolean | undefined;
                    experimental_includeClipboard?: boolean | undefined;
                    experimental_includeRecentlyVisitedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeRecentlyEditedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeDiff?: boolean | undefined;
                    experimental_enableStaticContextualization?:
                      | boolean
                      | undefined;
                  }
                | undefined;
              sourceFile?: string | undefined;
              region?: string | undefined;
              projectId?: string | undefined;
              keyfile_json_path?: string | undefined;
              wif_json_path?: string | undefined;
              dbllm_apikey?: string | undefined;
              data_classification?: string | undefined;
              dbllm_urlendpoint?: string | undefined;
              kannon_id?: string | undefined;
            }
        )[]
      | undefined;
    data?:
      | {
          name: string;
          schema: string;
          destination: string;
          apiKey?: string | undefined;
          requestOptions?:
            | {
                timeout?: number | undefined;
                verifySsl?: boolean | undefined;
                caBundlePath?: string | string[] | undefined;
                proxy?: string | undefined;
                headers?: Record<string, string> | undefined;
                extraBodyProperties?: Record<string, any> | undefined;
                noProxy?: string[] | undefined;
                clientCertificate?:
                  | {
                      cert: string;
                      key: string;
                      passphrase?: string | undefined;
                    }
                  | undefined;
              }
            | undefined;
          level?: "all" | "noCode" | undefined;
          events?: string[] | undefined;
        }[]
      | undefined;
    mcpServers?:
      | {
          name: string;
          type?: "sse" | "stdio" | "streamable-http" | undefined;
          url?: string | undefined;
          requestOptions?:
            | {
                timeout?: number | undefined;
                verifySsl?: boolean | undefined;
                caBundlePath?: string | string[] | undefined;
                proxy?: string | undefined;
                headers?: Record<string, string> | undefined;
                extraBodyProperties?: Record<string, any> | undefined;
                noProxy?: string[] | undefined;
                clientCertificate?:
                  | {
                      cert: string;
                      key: string;
                      passphrase?: string | undefined;
                    }
                  | undefined;
              }
            | undefined;
          env?: Record<string, string> | undefined;
          sourceFile?: string | undefined;
          command?: string | undefined;
          faviconUrl?: string | undefined;
          args?: string[] | undefined;
          cwd?: string | undefined;
          connectionTimeout?: number | undefined;
        }[]
      | undefined;
    prompts?:
      | {
          name: string;
          prompt: string;
          sourceFile?: string | undefined;
          description?: string | undefined;
        }[]
      | undefined;
    docs?:
      | {
          name: string;
          startUrl: string;
          sourceFile?: string | undefined;
          faviconUrl?: string | undefined;
          rootUrl?: string | undefined;
          useLocalCrawling?: boolean | undefined;
        }[]
      | undefined;
  },
  dbsaicleConfig: DbSaicleConfig,
  localErrors: ConfigValidationError[],
) {
  try {
    const jiraCfg = extractOptionalJiraConfig(config);
    if (jiraCfg && (jiraCfg.domain || jiraCfg.apiToken || jiraCfg.authEmail)) {
      dbsaicleConfig.jira = jiraCfg;
      // warn if incomplete
      if (!jiraCfg.domain || !jiraCfg.apiToken || !jiraCfg.authEmail) {
        localErrors.push({
          fatal: false,
          message:
            "Partial Jira configuration found in config.yaml â€” provide a root `jira` block with `domain`, `apiToken`, and `authEmail` for full functionality (or set the equivalent env vars).",
        });
      }
    }
  } catch (e) {
    // ignore extraction errors
  }
}

function extractConfluenceConfigInFlow(
  config: {
    name: string;
    version: string;
    env?: Record<string, string | number | boolean> | undefined;
    schema?: string | undefined;
    rules?:
      | (
          | string
          | {
              name: string;
              rule: string;
              regex?: string | string[] | undefined;
              sourceFile?: string | undefined;
              description?: string | undefined;
              globs?: string | string[] | undefined;
              alwaysApply?: boolean | undefined;
              invokable?: boolean | undefined;
            }
        )[]
      | undefined;
    context?:
      | { provider: string; params?: any; name?: string | undefined }[]
      | undefined;
    metadata?:
      | (Record<string, string> & {
          description?: string | undefined;
          author?: string | undefined;
          license?: string | undefined;
          tags?: string | undefined;
          sourceCodeUrl?: string | undefined;
          iconUrl?: string | undefined;
        })
      | undefined;
    jira?: { domain: string; apiToken: string; authEmail: string } | undefined;
    confluence?:
      | { apiToken: string; confluenceBaseUrl: string; userEmail: string }
      | undefined;
    models?:
      | (
          | {
              provider: "dbsaicle-proxy";
              orgScopeId: string | null;
              onPremProxyUrl: string | null;
              name: string;
              model: string;
              apiKeyLocation?: string | undefined;
              envSecretLocations?: Record<string, string> | undefined;
              apiKey?: string | undefined;
              apiBase?: string | undefined;
              maxStopWords?: number | undefined;
              roles?:
                | (
                    | "chat"
                    | "autocomplete"
                    | "embed"
                    | "rerank"
                    | "edit"
                    | "apply"
                    | "summarize"
                  )[]
                | undefined;
              capabilities?: string[] | undefined;
              defaultCompletionOptions?:
                | {
                    contextLength?: number | undefined;
                    maxTokens?: number | undefined;
                    temperature?: number | undefined;
                    topP?: number | undefined;
                    topK?: number | undefined;
                    minP?: number | undefined;
                    presencePenalty?: number | undefined;
                    frequencyPenalty?: number | undefined;
                    stop?: string[] | undefined;
                    n?: number | undefined;
                    reasoning?: boolean | undefined;
                    reasoningBudgetTokens?: number | undefined;
                    promptCaching?: boolean | undefined;
                    stream?: boolean | undefined;
                  }
                | undefined;
              cacheBehavior?:
                | {
                    cacheSystemMessage?: boolean | undefined;
                    cacheConversation?: boolean | undefined;
                  }
                | undefined;
              requestOptions?:
                | {
                    timeout?: number | undefined;
                    verifySsl?: boolean | undefined;
                    caBundlePath?: string | string[] | undefined;
                    proxy?: string | undefined;
                    headers?: Record<string, string> | undefined;
                    extraBodyProperties?: Record<string, any> | undefined;
                    noProxy?: string[] | undefined;
                    clientCertificate?:
                      | {
                          cert: string;
                          key: string;
                          passphrase?: string | undefined;
                        }
                      | undefined;
                  }
                | undefined;
              embedOptions?:
                | {
                    maxChunkSize?: number | undefined;
                    maxBatchSize?: number | undefined;
                    embeddingPrefixes?:
                      | Partial<Record<"chunk" | "query", string>>
                      | undefined;
                  }
                | undefined;
              chatOptions?:
                | {
                    baseSystemMessage?: string | undefined;
                    baseAgentSystemMessage?: string | undefined;
                    basePlanSystemMessage?: string | undefined;
                  }
                | undefined;
              promptTemplates?:
                | {
                    chat?:
                      | "llama2"
                      | "alpaca"
                      | "zephyr"
                      | "phi2"
                      | "phind"
                      | "anthropic"
                      | "chatml"
                      | "none"
                      | "openchat"
                      | "deepseek"
                      | "xwin-coder"
                      | "neural-chat"
                      | "codellama-70b"
                      | "llava"
                      | "gemma"
                      | "granite"
                      | "llama3"
                      | "codestral"
                      | undefined;
                    autocomplete?: string | undefined;
                    edit?: string | undefined;
                    apply?: string | undefined;
                  }
                | undefined;
              useLegacyCompletionsEndpoint?: boolean | undefined;
              env?: Record<string, string | number | boolean> | undefined;
              autocompleteOptions?:
                | {
                    disable?: boolean | undefined;
                    maxPromptTokens?: number | undefined;
                    debounceDelay?: number | undefined;
                    modelTimeout?: number | undefined;
                    maxSuffixPercentage?: number | undefined;
                    prefixPercentage?: number | undefined;
                    transform?: boolean | undefined;
                    template?: string | undefined;
                    onlyMyCode?: boolean | undefined;
                    useCache?: boolean | undefined;
                    useImports?: boolean | undefined;
                    useRecentlyEdited?: boolean | undefined;
                    useRecentlyOpened?: boolean | undefined;
                    experimental_includeClipboard?: boolean | undefined;
                    experimental_includeRecentlyVisitedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeRecentlyEditedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeDiff?: boolean | undefined;
                    experimental_enableStaticContextualization?:
                      | boolean
                      | undefined;
                  }
                | undefined;
            }
          | {
              provider: string;
              name: string;
              model: string;
              email?: string | undefined;
              apiKey?: string | undefined;
              apiBase?: string | undefined;
              maxStopWords?: number | undefined;
              roles?:
                | (
                    | "chat"
                    | "autocomplete"
                    | "embed"
                    | "rerank"
                    | "edit"
                    | "apply"
                    | "summarize"
                  )[]
                | undefined;
              capabilities?: string[] | undefined;
              defaultCompletionOptions?:
                | {
                    contextLength?: number | undefined;
                    maxTokens?: number | undefined;
                    temperature?: number | undefined;
                    topP?: number | undefined;
                    topK?: number | undefined;
                    minP?: number | undefined;
                    presencePenalty?: number | undefined;
                    frequencyPenalty?: number | undefined;
                    stop?: string[] | undefined;
                    n?: number | undefined;
                    reasoning?: boolean | undefined;
                    reasoningBudgetTokens?: number | undefined;
                    promptCaching?: boolean | undefined;
                    stream?: boolean | undefined;
                  }
                | undefined;
              cacheBehavior?:
                | {
                    cacheSystemMessage?: boolean | undefined;
                    cacheConversation?: boolean | undefined;
                  }
                | undefined;
              requestOptions?:
                | {
                    timeout?: number | undefined;
                    verifySsl?: boolean | undefined;
                    caBundlePath?: string | string[] | undefined;
                    proxy?: string | undefined;
                    headers?: Record<string, string> | undefined;
                    extraBodyProperties?: Record<string, any> | undefined;
                    noProxy?: string[] | undefined;
                    clientCertificate?:
                      | {
                          cert: string;
                          key: string;
                          passphrase?: string | undefined;
                        }
                      | undefined;
                  }
                | undefined;
              embedOptions?:
                | {
                    maxChunkSize?: number | undefined;
                    maxBatchSize?: number | undefined;
                    embeddingPrefixes?:
                      | Partial<Record<"chunk" | "query", string>>
                      | undefined;
                  }
                | undefined;
              chatOptions?:
                | {
                    baseSystemMessage?: string | undefined;
                    baseAgentSystemMessage?: string | undefined;
                    basePlanSystemMessage?: string | undefined;
                  }
                | undefined;
              promptTemplates?:
                | {
                    chat?:
                      | "llama2"
                      | "alpaca"
                      | "zephyr"
                      | "phi2"
                      | "phind"
                      | "anthropic"
                      | "chatml"
                      | "none"
                      | "openchat"
                      | "deepseek"
                      | "xwin-coder"
                      | "neural-chat"
                      | "codellama-70b"
                      | "llava"
                      | "gemma"
                      | "granite"
                      | "llama3"
                      | "codestral"
                      | undefined;
                    autocomplete?: string | undefined;
                    edit?: string | undefined;
                    apply?: string | undefined;
                  }
                | undefined;
              useLegacyCompletionsEndpoint?: boolean | undefined;
              env?: Record<string, string | number | boolean> | undefined;
              autocompleteOptions?:
                | {
                    disable?: boolean | undefined;
                    maxPromptTokens?: number | undefined;
                    debounceDelay?: number | undefined;
                    modelTimeout?: number | undefined;
                    maxSuffixPercentage?: number | undefined;
                    prefixPercentage?: number | undefined;
                    transform?: boolean | undefined;
                    template?: string | undefined;
                    onlyMyCode?: boolean | undefined;
                    useCache?: boolean | undefined;
                    useImports?: boolean | undefined;
                    useRecentlyEdited?: boolean | undefined;
                    useRecentlyOpened?: boolean | undefined;
                    experimental_includeClipboard?: boolean | undefined;
                    experimental_includeRecentlyVisitedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeRecentlyEditedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeDiff?: boolean | undefined;
                    experimental_enableStaticContextualization?:
                      | boolean
                      | undefined;
                  }
                | undefined;
              sourceFile?: string | undefined;
              region?: string | undefined;
              projectId?: string | undefined;
              keyfile_json_path?: string | undefined;
              wif_json_path?: string | undefined;
              dbllm_apikey?: string | undefined;
              data_classification?: string | undefined;
              dbllm_urlendpoint?: string | undefined;
              kannon_id?: string | undefined;
            }
        )[]
      | undefined;
    data?:
      | {
          name: string;
          schema: string;
          destination: string;
          apiKey?: string | undefined;
          requestOptions?:
            | {
                timeout?: number | undefined;
                verifySsl?: boolean | undefined;
                caBundlePath?: string | string[] | undefined;
                proxy?: string | undefined;
                headers?: Record<string, string> | undefined;
                extraBodyProperties?: Record<string, any> | undefined;
                noProxy?: string[] | undefined;
                clientCertificate?:
                  | {
                      cert: string;
                      key: string;
                      passphrase?: string | undefined;
                    }
                  | undefined;
              }
            | undefined;
          level?: "all" | "noCode" | undefined;
          events?: string[] | undefined;
        }[]
      | undefined;
    mcpServers?:
      | {
          name: string;
          type?: "sse" | "stdio" | "streamable-http" | undefined;
          url?: string | undefined;
          requestOptions?:
            | {
                timeout?: number | undefined;
                verifySsl?: boolean | undefined;
                caBundlePath?: string | string[] | undefined;
                proxy?: string | undefined;
                headers?: Record<string, string> | undefined;
                extraBodyProperties?: Record<string, any> | undefined;
                noProxy?: string[] | undefined;
                clientCertificate?:
                  | {
                      cert: string;
                      key: string;
                      passphrase?: string | undefined;
                    }
                  | undefined;
              }
            | undefined;
          env?: Record<string, string> | undefined;
          sourceFile?: string | undefined;
          command?: string | undefined;
          faviconUrl?: string | undefined;
          args?: string[] | undefined;
          cwd?: string | undefined;
          connectionTimeout?: number | undefined;
        }[]
      | undefined;
    prompts?:
      | {
          name: string;
          prompt: string;
          sourceFile?: string | undefined;
          description?: string | undefined;
        }[]
      | undefined;
    docs?:
      | {
          name: string;
          startUrl: string;
          sourceFile?: string | undefined;
          faviconUrl?: string | undefined;
          rootUrl?: string | undefined;
          useLocalCrawling?: boolean | undefined;
        }[]
      | undefined;
  },
  dbsaicleConfig: DbSaicleConfig,
  localErrors: ConfigValidationError[],
) {
  try {
    const confluenceCfg = extractOptionalConfluenceConfig(config);
    if (
      confluenceCfg &&
      (confluenceCfg.confluenceBaseUrl ||
        confluenceCfg.apiToken ||
        confluenceCfg.userEmail)
    ) {
      dbsaicleConfig.confluence = confluenceCfg;
      // warn if incomplete
      if (
        !confluenceCfg.confluenceBaseUrl ||
        !confluenceCfg.apiToken ||
        !confluenceCfg.userEmail
      ) {
        localErrors.push({
          fatal: false,
          message:
            "Partial Confluence configuration found in config.yaml â€” provide a root `confluence` block with `baseUrl`, `apiToken`, and `authEmail` for full functionality (or set the equivalent env vars).",
        });
      }
    }
  } catch (e) {
    // ignore extraction errors
  }
}

function extractOptionalJiraConfig(config: AssistantUnrolled) {
  // Prefer a root `jira` object in the YAML:
  // jira:
  //   domain: yourcompany.atlassian.net
  //   apiToken: <token>
  //   authEmail: user@example.com
  const jira: { domain?: string; apiToken?: string; authEmail?: string } = {};

  try {
    const asAny = config as any;
    const jiraBlock = asAny.jira as
      | { domain?: string; apiToken?: string; authEmail?: string }
      | undefined;
    if (jiraBlock) {
      if (jiraBlock.domain) jira.domain = String(jiraBlock.domain);
      if (jiraBlock.apiToken) jira.apiToken = String(jiraBlock.apiToken);
      if (jiraBlock.authEmail) jira.authEmail = String(jiraBlock.authEmail);
    }
  } catch (e) {
    // ignore
  }

  // Fallback: check top-level env map
  try {
    const envMap = (config as any).env as Record<string, any> | undefined;
    if (envMap) {
      if (!jira.domain && envMap.JIRA_DOMAIN)
        jira.domain = String(envMap.JIRA_DOMAIN);
      if (!jira.apiToken && envMap.JIRA_API_TOKEN)
        jira.apiToken = String(envMap.JIRA_API_TOKEN);
      if (!jira.authEmail && envMap.JIRA_AUTH_EMAIL)
        jira.authEmail = String(envMap.JIRA_AUTH_EMAIL);
      // older converter may use these keys
      if (!jira.apiToken && envMap.JIRA_TOKEN)
        jira.apiToken = String(envMap.JIRA_TOKEN);
      if (!jira.authEmail && envMap.JIRA_EMAIL)
        jira.authEmail = String(envMap.JIRA_EMAIL);
    }
  } catch (e) {
    // ignore
  }

  // Legacy: also allow top-level scalar keys on the config (yaml authors may put these directly)
  try {
    const asAny = config as any;
    if (!jira.domain && asAny.jira_domain)
      jira.domain = String(asAny.jira_domain);
    if (!jira.apiToken && asAny.jira_api_token)
      jira.apiToken = String(asAny.jira_api_token);
    if (!jira.authEmail && asAny.jira_auth_email)
      jira.authEmail = String(asAny.jira_auth_email);
  } catch (e) {
    // ignore
  }

  return jira;
}

function extractOptionalConfluenceConfig(config: AssistantUnrolled) {
  // Prefer a root `confluence` object in the YAML:
  // confluence:
  //   baseUrl: https://yourcompany.atlassian.net/wiki
  //   apiToken: <token>
  //   authEmail: user@example.com
  const confluence: {
    confluenceBaseUrl?: string;
    apiToken?: string;
    userEmail?: string;
  } = {};

  try {
    const asAny = config as any;
    const confluenceBlock = asAny.confluence as
      | { confluenceBaseUrl?: string; apiToken?: string; userEmail?: string }
      | undefined;
    if (confluenceBlock) {
      if (confluenceBlock.confluenceBaseUrl)
        confluence.confluenceBaseUrl = String(
          confluenceBlock.confluenceBaseUrl,
        );
      if (confluenceBlock.apiToken)
        confluence.apiToken = String(confluenceBlock.apiToken);
      if (confluenceBlock.userEmail)
        confluence.userEmail = String(confluenceBlock.userEmail);
    }
  } catch (e) {
    // ignore
  }

  // Fallback: check top-level env map
  try {
    const envMap = (config as any).env as Record<string, any> | undefined;
    if (envMap) {
      if (!confluence.confluenceBaseUrl && envMap.CONFLUENCE_BASE_URL)
        confluence.confluenceBaseUrl = String(envMap.CONFLUENCE_BASE_URL);
      if (!confluence.apiToken && envMap.CONFLUENCE_API_TOKEN)
        confluence.apiToken = String(envMap.CONFLUENCE_API_TOKEN);
      if (!confluence.userEmail && envMap.CONFLUENCE_USER_EMAIL)
        confluence.userEmail = String(envMap.CONFLUENCE_USER_EMAIL);
    }
  } catch (e) {
    // ignore
  }

  // Legacy: also allow top-level scalar keys on the config (yaml authors may put these directly)
  try {
    const asAny = config as any;
    if (!confluence.confluenceBaseUrl && asAny.confluence_base_url)
      confluence.confluenceBaseUrl = String(asAny.confluence_base_url);
    if (!confluence.apiToken && asAny.confluence_api_token)
      confluence.apiToken = String(asAny.confluence_api_token);
    if (!confluence.userEmail && asAny.confluence_user_email)
      confluence.userEmail = String(asAny.confluence_user_email);
  } catch (e) {
    // ignore
  }

  return confluence;
}

function extractServiceNowConfigInFlow(
  config: {
    name: string;
    version: string;
    env?: Record<string, string | number | boolean> | undefined;
    schema?: string | undefined;
    rules?:
      | (
          | string
          | {
              name: string;
              rule: string;
              regex?: string | string[] | undefined;
              sourceFile?: string | undefined;
              description?: string | undefined;
              globs?: string | string[] | undefined;
              alwaysApply?: boolean | undefined;
              invokable?: boolean | undefined;
            }
        )[]
      | undefined;
    context?:
      | { provider: string; params?: any; name?: string | undefined }[]
      | undefined;
    metadata?:
      | (Record<string, string> & {
          description?: string | undefined;
          author?: string | undefined;
          license?: string | undefined;
          tags?: string | undefined;
          sourceCodeUrl?: string | undefined;
          iconUrl?: string | undefined;
        })
      | undefined;
    jira?: { domain: string; apiToken: string; authEmail: string } | undefined;
    confluence?:
      | { apiToken: string; confluenceBaseUrl: string; userEmail: string }
      | undefined;
    servicenow?:
      | {
          instanceUrl?: string;
          auth?: {
            type?: "basic" | "oauth" | "api_key";
            basic?: { username?: string; password?: string };
            oauth?: {
              clientId?: string;
              clientSecret?: string;
              username?: string;
              password?: string;
              tokenUrl?: string;
            };
            apiKey?: { apiKey?: string; headerName?: string };
          };
          timeout?: number;
        }
      | undefined;
    models?:
      | (
          | {
              provider: "dbsaicle-proxy";
              orgScopeId: string | null;
              onPremProxyUrl: string | null;
              name: string;
              model: string;
              apiKeyLocation?: string | undefined;
              envSecretLocations?: Record<string, string> | undefined;
              apiKey?: string | undefined;
              apiBase?: string | undefined;
              maxStopWords?: number | undefined;
              roles?:
                | (
                    | "chat"
                    | "autocomplete"
                    | "embed"
                    | "rerank"
                    | "edit"
                    | "apply"
                    | "summarize"
                  )[]
                | undefined;
              capabilities?: string[] | undefined;
              defaultCompletionOptions?:
                | {
                    contextLength?: number | undefined;
                    maxTokens?: number | undefined;
                    temperature?: number | undefined;
                    topP?: number | undefined;
                    topK?: number | undefined;
                    minP?: number | undefined;
                    presencePenalty?: number | undefined;
                    frequencyPenalty?: number | undefined;
                    stop?: string[] | undefined;
                    n?: number | undefined;
                    reasoning?: boolean | undefined;
                    reasoningBudgetTokens?: number | undefined;
                    promptCaching?: boolean | undefined;
                    stream?: boolean | undefined;
                  }
                | undefined;
              cacheBehavior?:
                | {
                    cacheSystemMessage?: boolean | undefined;
                    cacheConversation?: boolean | undefined;
                  }
                | undefined;
              requestOptions?:
                | {
                    timeout?: number | undefined;
                    verifySsl?: boolean | undefined;
                    caBundlePath?: string | string[] | undefined;
                    proxy?: string | undefined;
                    headers?: Record<string, string> | undefined;
                    extraBodyProperties?: Record<string, any> | undefined;
                    noProxy?: string[] | undefined;
                    clientCertificate?:
                      | {
                          cert: string;
                          key: string;
                          passphrase?: string | undefined;
                        }
                      | undefined;
                  }
                | undefined;
              embedOptions?:
                | {
                    maxChunkSize?: number | undefined;
                    maxBatchSize?: number | undefined;
                    embeddingPrefixes?:
                      | Partial<Record<"chunk" | "query", string>>
                      | undefined;
                  }
                | undefined;
              chatOptions?:
                | {
                    baseSystemMessage?: string | undefined;
                    baseAgentSystemMessage?: string | undefined;
                    basePlanSystemMessage?: string | undefined;
                  }
                | undefined;
              promptTemplates?:
                | {
                    chat?:
                      | "llama2"
                      | "alpaca"
                      | "zephyr"
                      | "phi2"
                      | "phind"
                      | "anthropic"
                      | "chatml"
                      | "none"
                      | "openchat"
                      | "deepseek"
                      | "xwin-coder"
                      | "neural-chat"
                      | "codellama-70b"
                      | "llava"
                      | "gemma"
                      | "granite"
                      | "llama3"
                      | "codestral"
                      | undefined;
                    autocomplete?: string | undefined;
                    edit?: string | undefined;
                    apply?: string | undefined;
                  }
                | undefined;
              useLegacyCompletionsEndpoint?: boolean | undefined;
              env?: Record<string, string | number | boolean> | undefined;
              autocompleteOptions?:
                | {
                    disable?: boolean | undefined;
                    maxPromptTokens?: number | undefined;
                    debounceDelay?: number | undefined;
                    modelTimeout?: number | undefined;
                    maxSuffixPercentage?: number | undefined;
                    prefixPercentage?: number | undefined;
                    transform?: boolean | undefined;
                    template?: string | undefined;
                    onlyMyCode?: boolean | undefined;
                    useCache?: boolean | undefined;
                    useImports?: boolean | undefined;
                    useRecentlyEdited?: boolean | undefined;
                    useRecentlyOpened?: boolean | undefined;
                    experimental_includeClipboard?: boolean | undefined;
                    experimental_includeRecentlyVisitedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeRecentlyEditedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeDiff?: boolean | undefined;
                    experimental_enableStaticContextualization?:
                      | boolean
                      | undefined;
                  }
                | undefined;
            }
          | {
              provider: string;
              name: string;
              model: string;
              email?: string | undefined;
              apiKey?: string | undefined;
              apiBase?: string | undefined;
              maxStopWords?: number | undefined;
              roles?:
                | (
                    | "chat"
                    | "autocomplete"
                    | "embed"
                    | "rerank"
                    | "edit"
                    | "apply"
                    | "summarize"
                  )[]
                | undefined;
              capabilities?: string[] | undefined;
              defaultCompletionOptions?:
                | {
                    contextLength?: number | undefined;
                    maxTokens?: number | undefined;
                    temperature?: number | undefined;
                    topP?: number | undefined;
                    topK?: number | undefined;
                    minP?: number | undefined;
                    presencePenalty?: number | undefined;
                    frequencyPenalty?: number | undefined;
                    stop?: string[] | undefined;
                    n?: number | undefined;
                    reasoning?: boolean | undefined;
                    reasoningBudgetTokens?: number | undefined;
                    promptCaching?: boolean | undefined;
                    stream?: boolean | undefined;
                  }
                | undefined;
              cacheBehavior?:
                | {
                    cacheSystemMessage?: boolean | undefined;
                    cacheConversation?: boolean | undefined;
                  }
                | undefined;
              requestOptions?:
                | {
                    timeout?: number | undefined;
                    verifySsl?: boolean | undefined;
                    caBundlePath?: string | string[] | undefined;
                    proxy?: string | undefined;
                    headers?: Record<string, string> | undefined;
                    extraBodyProperties?: Record<string, any> | undefined;
                    noProxy?: string[] | undefined;
                    clientCertificate?:
                      | {
                          cert: string;
                          key: string;
                          passphrase?: string | undefined;
                        }
                      | undefined;
                  }
                | undefined;
              embedOptions?:
                | {
                    maxChunkSize?: number | undefined;
                    maxBatchSize?: number | undefined;
                    embeddingPrefixes?:
                      | Partial<Record<"chunk" | "query", string>>
                      | undefined;
                  }
                | undefined;
              chatOptions?:
                | {
                    baseSystemMessage?: string | undefined;
                    baseAgentSystemMessage?: string | undefined;
                    basePlanSystemMessage?: string | undefined;
                  }
                | undefined;
              promptTemplates?:
                | {
                    chat?:
                      | "llama2"
                      | "alpaca"
                      | "zephyr"
                      | "phi2"
                      | "phind"
                      | "anthropic"
                      | "chatml"
                      | "none"
                      | "openchat"
                      | "deepseek"
                      | "xwin-coder"
                      | "neural-chat"
                      | "codellama-70b"
                      | "llava"
                      | "gemma"
                      | "granite"
                      | "llama3"
                      | "codestral"
                      | undefined;
                    autocomplete?: string | undefined;
                    edit?: string | undefined;
                    apply?: string | undefined;
                  }
                | undefined;
              useLegacyCompletionsEndpoint?: boolean | undefined;
              env?: Record<string, string | number | boolean> | undefined;
              autocompleteOptions?:
                | {
                    disable?: boolean | undefined;
                    maxPromptTokens?: number | undefined;
                    debounceDelay?: number | undefined;
                    modelTimeout?: number | undefined;
                    maxSuffixPercentage?: number | undefined;
                    prefixPercentage?: number | undefined;
                    transform?: boolean | undefined;
                    template?: string | undefined;
                    onlyMyCode?: boolean | undefined;
                    useCache?: boolean | undefined;
                    useImports?: boolean | undefined;
                    useRecentlyEdited?: boolean | undefined;
                    useRecentlyOpened?: boolean | undefined;
                    experimental_includeClipboard?: boolean | undefined;
                    experimental_includeRecentlyVisitedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeRecentlyEditedRanges?:
                      | boolean
                      | undefined;
                    experimental_includeDiff?: boolean | undefined;
                    experimental_enableStaticContextualization?:
                      | boolean
                      | undefined;
                  }
                | undefined;
            }
        )[]
      | undefined;
    data?:
      | {
          name: string;
          schema: string;
          destination: string;
          apiKey?: string | undefined;
          requestOptions?:
            | {
                timeout?: number | undefined;
                verifySsl?: boolean | undefined;
                caBundlePath?: string | string[] | undefined;
                proxy?: string | undefined;
                headers?: Record<string, string> | undefined;
                extraBodyProperties?: Record<string, any> | undefined;
                noProxy?: string[] | undefined;
                clientCertificate?:
                  | {
                      cert: string;
                      key: string;
                      passphrase?: string | undefined;
                    }
                  | undefined;
              }
            | undefined;
          level?: "all" | "noCode" | undefined;
          events?: string[] | undefined;
        }[]
      | undefined;
    mcpServers?:
      | {
          name: string;
          type?: "sse" | "stdio" | "streamable-http" | undefined;
          url?: string | undefined;
          requestOptions?:
            | {
                timeout?: number | undefined;
                verifySsl?: boolean | undefined;
                caBundlePath?: string | string[] | undefined;
                proxy?: string | undefined;
                headers?: Record<string, string> | undefined;
                extraBodyProperties?: Record<string, any> | undefined;
                noProxy?: string[] | undefined;
                clientCertificate?:
                  | {
                      cert: string;
                      key: string;
                      passphrase?: string | undefined;
                    }
                  | undefined;
              }
            | undefined;
          env?: Record<string, string> | undefined;
          sourceFile?: string | undefined;
          command?: string | undefined;
          faviconUrl?: string | undefined;
          args?: string[] | undefined;
          cwd?: string | undefined;
          connectionTimeout?: number | undefined;
        }[]
      | undefined;
    prompts?:
      | {
          name: string;
          prompt: string;
          sourceFile?: string | undefined;
          description?: string | undefined;
        }[]
      | undefined;
    docs?:
      | {
          name: string;
          startUrl: string;
          sourceFile?: string | undefined;
          faviconUrl?: string | undefined;
          rootUrl?: string | undefined;
          useLocalCrawling?: boolean | undefined;
        }[]
      | undefined;
  },
  dbsaicleConfig: DbSaicleConfig,
  localErrors: ConfigValidationError[],
) {
  try {
    const servicenowCfg = extractOptionalServiceNowConfig(
      config as AssistantUnrolled,
    );
    if (
      servicenowCfg &&
      (servicenowCfg.instanceUrl ||
        servicenowCfg.auth?.type ||
        servicenowCfg.timeout)
    ) {
      dbsaicleConfig.servicenow = servicenowCfg;
      if (!servicenowCfg.instanceUrl || !servicenowCfg.auth?.type) {
        localErrors.push({
          fatal: false,
          message:
            "Partial ServiceNow configuration found in config.yaml; provide a root `servicenow` block with `instanceUrl` and `auth.type` (or set equivalent env vars) for full functionality.",
        });
      } else if (servicenowCfg.auth.type === "basic") {
        if (
          !servicenowCfg.auth.basic?.username ||
          !servicenowCfg.auth.basic?.password
        ) {
          localErrors.push({
            fatal: false,
            message:
              "ServiceNow auth type 'basic' requires `auth.basic.username` and `auth.basic.password`.",
          });
        }
      } else if (servicenowCfg.auth.type === "oauth") {
        if (
          !servicenowCfg.auth.oauth?.clientId ||
          !servicenowCfg.auth.oauth?.clientSecret
        ) {
          localErrors.push({
            fatal: false,
            message:
              "ServiceNow auth type 'oauth' requires `auth.oauth.clientId` and `auth.oauth.clientSecret`.",
          });
        }
      } else if (servicenowCfg.auth.type === "api_key") {
        if (!servicenowCfg.auth.apiKey?.apiKey) {
          localErrors.push({
            fatal: false,
            message:
              "ServiceNow auth type 'api_key' requires `auth.apiKey.apiKey`.",
          });
        }
      }
    }
  } catch (e) {
    // ignore extraction errors
  }

  try {
    const ossCfg = extractOptionalOssVulnerabilityConfig(
      config as AssistantUnrolled,
    );
    if (ossCfg && (ossCfg.jfrogPlatformUrl || ossCfg.jfrogAccessToken)) {
      dbsaicleConfig.ossVulnerability = ossCfg;
      if (!ossCfg.jfrogAccessToken) {
        localErrors.push({
          fatal: false,
          message:
            "Partial OSS vulnerability scan configuration found in config.yaml; provide `ossVulnerability.jfrogAccessToken` (or set JFROG_ACCESS_TOKEN) for full functionality.",
        });
      }
    }
  } catch (e) {
    // ignore extraction errors
  }
}

function extractOptionalServiceNowConfig(config: AssistantUnrolled) {
  const authTypes = ["basic", "oauth", "api_key"] as const;
  type ServiceNowAuthType = (typeof authTypes)[number];
  const toAuthType = (value?: string): ServiceNowAuthType | undefined => {
    if (!value) return undefined;
    return authTypes.includes(value as ServiceNowAuthType)
      ? (value as ServiceNowAuthType)
      : undefined;
  };

  const servicenow: {
    instanceUrl?: string;
    auth?: {
      type?: ServiceNowAuthType;
      basic?: { username?: string; password?: string };
      oauth?: {
        clientId?: string;
        clientSecret?: string;
        username?: string;
        password?: string;
        tokenUrl?: string;
      };
      apiKey?: { apiKey?: string; headerName?: string };
    };
    timeout?: number;
  } = {};

  try {
    const asAny = config as any;
    const block = asAny.servicenow as
      | {
          instanceUrl?: string;
          instance_url?: string;
          auth?: any;
          timeout?: number;
        }
      | undefined;
    if (block) {
      if (block.instanceUrl) servicenow.instanceUrl = String(block.instanceUrl);
      if (!servicenow.instanceUrl && block.instance_url) {
        servicenow.instanceUrl = String(block.instance_url);
      }
      if (block.timeout) servicenow.timeout = Number(block.timeout);
      if (block.auth) {
        const oauthBlock = block.auth.oauth;
        const apiKeyBlock = block.auth.apiKey || block.auth.api_key;
        servicenow.auth = {
          type: toAuthType(block.auth.type ? String(block.auth.type) : undefined),
          basic: block.auth.basic
            ? {
                username: block.auth.basic.username
                  ? String(block.auth.basic.username)
                  : undefined,
                password: block.auth.basic.password
                  ? String(block.auth.basic.password)
                  : undefined,
              }
            : undefined,
          oauth: oauthBlock
            ? {
                clientId: oauthBlock.clientId
                  ? String(oauthBlock.clientId)
                  : oauthBlock.client_id
                    ? String(oauthBlock.client_id)
                    : undefined,
                clientSecret: oauthBlock.clientSecret
                  ? String(oauthBlock.clientSecret)
                  : oauthBlock.client_secret
                    ? String(oauthBlock.client_secret)
                    : undefined,
                username: oauthBlock.username
                  ? String(oauthBlock.username)
                  : undefined,
                password: oauthBlock.password
                  ? String(oauthBlock.password)
                  : undefined,
                tokenUrl: oauthBlock.tokenUrl
                  ? String(oauthBlock.tokenUrl)
                  : oauthBlock.token_url
                    ? String(oauthBlock.token_url)
                    : undefined,
              }
            : undefined,
          apiKey: apiKeyBlock
            ? {
                apiKey: apiKeyBlock.apiKey
                  ? String(apiKeyBlock.apiKey)
                  : apiKeyBlock.api_key
                    ? String(apiKeyBlock.api_key)
                    : undefined,
                headerName: apiKeyBlock.headerName
                  ? String(apiKeyBlock.headerName)
                  : apiKeyBlock.header_name
                    ? String(apiKeyBlock.header_name)
                    : undefined,
              }
            : undefined,
        };
      }
    }
  } catch (e) {
    // ignore
  }

  try {
    const envMap = (config as any).env as Record<string, any> | undefined;
    if (envMap) {
      if (!servicenow.instanceUrl && envMap.SERVICENOW_INSTANCE_URL)
        servicenow.instanceUrl = String(envMap.SERVICENOW_INSTANCE_URL);
      if (!servicenow.timeout && envMap.SERVICENOW_TIMEOUT)
        servicenow.timeout = Number(envMap.SERVICENOW_TIMEOUT);
      if (!servicenow.auth) servicenow.auth = {};
      if (!servicenow.auth.type && envMap.SERVICENOW_AUTH_TYPE)
        servicenow.auth.type = toAuthType(String(envMap.SERVICENOW_AUTH_TYPE));
      if (
        servicenow.auth.type === "basic" ||
        (!servicenow.auth.type &&
          (envMap.SERVICENOW_USERNAME || envMap.SERVICENOW_PASSWORD))
      ) {
        servicenow.auth.type = servicenow.auth.type || "basic";
        servicenow.auth.basic = {
          username: envMap.SERVICENOW_USERNAME
            ? String(envMap.SERVICENOW_USERNAME)
            : servicenow.auth.basic?.username,
          password: envMap.SERVICENOW_PASSWORD
            ? String(envMap.SERVICENOW_PASSWORD)
            : servicenow.auth.basic?.password,
        };
      }
      if (
        servicenow.auth.type === "oauth" ||
        (!servicenow.auth.type &&
          (envMap.SERVICENOW_CLIENT_ID || envMap.SERVICENOW_CLIENT_SECRET))
      ) {
        servicenow.auth.type = servicenow.auth.type || "oauth";
        servicenow.auth.oauth = {
          clientId: envMap.SERVICENOW_CLIENT_ID
            ? String(envMap.SERVICENOW_CLIENT_ID)
            : servicenow.auth.oauth?.clientId,
          clientSecret: envMap.SERVICENOW_CLIENT_SECRET
            ? String(envMap.SERVICENOW_CLIENT_SECRET)
            : servicenow.auth.oauth?.clientSecret,
          username: envMap.SERVICENOW_USERNAME
            ? String(envMap.SERVICENOW_USERNAME)
            : servicenow.auth.oauth?.username,
          password: envMap.SERVICENOW_PASSWORD
            ? String(envMap.SERVICENOW_PASSWORD)
            : servicenow.auth.oauth?.password,
          tokenUrl: envMap.SERVICENOW_TOKEN_URL
            ? String(envMap.SERVICENOW_TOKEN_URL)
            : servicenow.auth.oauth?.tokenUrl,
        };
      }
      if (
        servicenow.auth.type === "api_key" ||
        (!servicenow.auth.type && envMap.SERVICENOW_API_KEY)
      ) {
        servicenow.auth.type = servicenow.auth.type || "api_key";
        servicenow.auth.apiKey = {
          apiKey: envMap.SERVICENOW_API_KEY
            ? String(envMap.SERVICENOW_API_KEY)
            : servicenow.auth.apiKey?.apiKey,
          headerName: envMap.SERVICENOW_API_KEY_HEADER
            ? String(envMap.SERVICENOW_API_KEY_HEADER)
            : servicenow.auth.apiKey?.headerName,
        };
      }
    }
  } catch (e) {
    // ignore
  }

  try {
    const asAny = config as any;
    if (!servicenow.instanceUrl && asAny.servicenow_instance_url)
      servicenow.instanceUrl = String(asAny.servicenow_instance_url);
    if (!servicenow.timeout && asAny.servicenow_timeout)
      servicenow.timeout = Number(asAny.servicenow_timeout);
    if (!servicenow.auth) servicenow.auth = {};
    if (!servicenow.auth.type && asAny.servicenow_auth_type)
      servicenow.auth.type = toAuthType(String(asAny.servicenow_auth_type));
    if (asAny.servicenow_username || asAny.servicenow_password) {
      servicenow.auth.basic = {
        username: asAny.servicenow_username
          ? String(asAny.servicenow_username)
          : servicenow.auth.basic?.username,
        password: asAny.servicenow_password
          ? String(asAny.servicenow_password)
          : servicenow.auth.basic?.password,
      };
    }
    if (asAny.servicenow_client_id || asAny.servicenow_client_secret) {
      servicenow.auth.oauth = {
        clientId: asAny.servicenow_client_id
          ? String(asAny.servicenow_client_id)
          : servicenow.auth.oauth?.clientId,
        clientSecret: asAny.servicenow_client_secret
          ? String(asAny.servicenow_client_secret)
          : servicenow.auth.oauth?.clientSecret,
        username: asAny.servicenow_username
          ? String(asAny.servicenow_username)
          : servicenow.auth.oauth?.username,
        password: asAny.servicenow_password
          ? String(asAny.servicenow_password)
          : servicenow.auth.oauth?.password,
        tokenUrl: asAny.servicenow_token_url
          ? String(asAny.servicenow_token_url)
          : servicenow.auth.oauth?.tokenUrl,
      };
      if (!servicenow.auth.type) {
        servicenow.auth.type = "oauth";
      }
    }
    if (asAny.servicenow_api_key || asAny.servicenow_api_key_header) {
      servicenow.auth.apiKey = {
        apiKey: asAny.servicenow_api_key
          ? String(asAny.servicenow_api_key)
          : servicenow.auth.apiKey?.apiKey,
        headerName: asAny.servicenow_api_key_header
          ? String(asAny.servicenow_api_key_header)
          : servicenow.auth.apiKey?.headerName,
      };
      if (!servicenow.auth.type) {
        servicenow.auth.type = "api_key";
      }
    }
  } catch (e) {
    // ignore
  }

  return servicenow;
}

function extractOptionalOssVulnerabilityConfig(config: AssistantUnrolled) {
  const oss: {
    jfrogPlatformUrl?: string;
    jfrogAccessToken?: string;
  } = {};

  try {
    const asAny = config as any;
    const block = asAny.ossVulnerability as
      | {
          jfrogPlatformUrl?: string;
          jfrogAccessToken?: string;
          jfrog_platform_url?: string;
          jfrog_access_token?: string;
        }
      | undefined;
    if (block) {
      if (block.jfrogPlatformUrl)
        oss.jfrogPlatformUrl = String(block.jfrogPlatformUrl);
      if (!oss.jfrogPlatformUrl && block.jfrog_platform_url) {
        oss.jfrogPlatformUrl = String(block.jfrog_platform_url);
      }
      if (block.jfrogAccessToken)
        oss.jfrogAccessToken = String(block.jfrogAccessToken);
      if (!oss.jfrogAccessToken && block.jfrog_access_token) {
        oss.jfrogAccessToken = String(block.jfrog_access_token);
      }
    }
  } catch (e) {
    // ignore
  }

  try {
    const envMap = (config as any).env as Record<string, any> | undefined;
    if (envMap) {
      if (!oss.jfrogPlatformUrl && envMap.JFROG_PLATFORM_URL)
        oss.jfrogPlatformUrl = String(envMap.JFROG_PLATFORM_URL);
      if (!oss.jfrogAccessToken && envMap.JFROG_ACCESS_TOKEN)
        oss.jfrogAccessToken = String(envMap.JFROG_ACCESS_TOKEN);
    }
  } catch (e) {
    // ignore
  }

  try {
    const asAny = config as any;
    if (!oss.jfrogPlatformUrl && asAny.jfrog_platform_url)
      oss.jfrogPlatformUrl = String(asAny.jfrog_platform_url);
    if (!oss.jfrogAccessToken && asAny.jfrog_access_token)
      oss.jfrogAccessToken = String(asAny.jfrog_access_token);
  } catch (e) {
    // ignore
  }

  return oss;
}

export async function loadDbSaicleConfigFromYaml(options: {
  ide: IDE;
  ideSettings: IdeSettings;
  ideInfo: IdeInfo;
  uniqueId: string;
  llmLogger: ILLMLogger;
  workOsAccessToken: string | undefined;
  overrideConfigYaml: AssistantUnrolled | undefined;
  controlPlaneClient: ControlPlaneClient;
  orgScopeId: string | null;
  packageIdentifier: PackageIdentifier;
}): Promise<ConfigResult<DbSaicleConfig>> {
  const {
    ide,
    ideSettings,
    ideInfo,
    uniqueId,
    llmLogger,
    workOsAccessToken,
    overrideConfigYaml,
    controlPlaneClient,
    orgScopeId,
    packageIdentifier,
  } = options;

  const configYamlResult = await loadConfigYaml({
    overrideConfigYaml,
    controlPlaneClient,
    orgScopeId,
    ideSettings,
    ide,
    packageIdentifier,
  });

  if (!configYamlResult.config || configYamlResult.configLoadInterrupted) {
    return {
      errors: configYamlResult.errors,
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  const { config: dbsaicleConfig, errors: localErrors } =
    await configYamlToDbSaicleConfig({
      config: configYamlResult.config,
      ide,
      ideSettings,
      ideInfo,
      uniqueId,
      llmLogger,
      workOsAccessToken,
    });

  // Apply shared config
  // TODO: override several of these values with user/org shared config
  // Don't try catch this - has security implications and failure should be fatal
  const sharedConfig = new GlobalContext().getSharedConfig();
  const withShared = modifyAnyConfigWithSharedConfig(
    dbsaicleConfig,
    sharedConfig,
  );
  if (withShared.allowAnonymousTelemetry === undefined) {
    withShared.allowAnonymousTelemetry = true;
  }

  return {
    config: withShared,
    errors: [...(configYamlResult.errors ?? []), ...localErrors],
    configLoadInterrupted: false,
  };
}
