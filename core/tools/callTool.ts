import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { ContextItem, Tool, ToolCall, ToolExtras } from "..";
import { MCPManagerSingleton } from "../context/mcp/MCPManagerSingleton";
import { canParseUrl } from "../util/url";
import { BuiltInToolNames } from "./builtIn";

import { browserActionImpl } from "./implementations/browserAction";
import { codebaseToolImpl } from "./implementations/codebaseTool";
import { createNewFileImpl } from "./implementations/createNewFile";
import { createRuleBlockImpl } from "./implementations/createRuleBlock";
import { fetchUrlContentImpl } from "./implementations/fetchUrlContent";
import { fileGlobSearchImpl } from "./implementations/globSearch";
import { grepSearchImpl } from "./implementations/grepSearch";
import { lsToolImpl } from "./implementations/lsTool";
import { readCurrentlyOpenFileImpl } from "./implementations/readCurrentlyOpenFile";
import { readFileImpl } from "./implementations/readFile";

import { readFileRangeImpl } from "./implementations/readFileRange";
import { requestRuleImpl } from "./implementations/requestRule";
import { runTerminalCommandImpl } from "./implementations/runTerminalCommand";
import { searchWebImpl } from "./implementations/searchWeb";
import { viewDiffImpl } from "./implementations/viewDiff";
import { viewRepoMapImpl } from "./implementations/viewRepoMap";
import { viewSubdirectoryImpl } from "./implementations/viewSubdirectory";
import { parsePdfImpl } from "./implementations/parsePdf";
import { parseExcelImpl } from "./implementations/parseExcel";
import { parseDocxImpl } from "./implementations/parseDocx";
import { extractEntitiesImpl } from "./implementations/extractEntities";
import { plantumlBuilderImpl } from "./implementations/plantumlBuilder";
import { safeParseToolCallArgs } from "./parseArgs";

import {
  handleConfluenceMutatingTools,
  handleConfluenceQueryTools,
} from "./implementations/confluenceToolImpl";
import { fetchUrlChunkImpl } from "./implementations/fetchUrlChunk";
import {
  handleJiraCreateTools,
  handleJiraMutatingTools,
  handleJiraQueryTools,
} from "./implementations/jiraToolImpl";

async function callHttpTool(
  url: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const response = await extras.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      arguments: args,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to call tool at ${url}:\n${JSON.stringify(data)}`);
  }

  return data.output;
}

export function encodeMCPToolUri(mcpId: string, toolName: string): string {
  return `mcp://${encodeURIComponent(mcpId)}/${encodeURIComponent(toolName)}`;
}

export function decodeMCPToolUri(uri: string): [string, string] | null {
  const url = new URL(uri);
  if (url.protocol !== "mcp:") {
    return null;
  }
  return [
    decodeURIComponent(url.hostname),
    decodeURIComponent(url.pathname).slice(1), // to remove leading '/'
  ];
}

async function callToolFromUri(
  uri: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const parseable = canParseUrl(uri);
  if (!parseable) {
    throw new Error(`Invalid URI: ${uri}`);
  }
  const parsedUri = new URL(uri);

  switch (parsedUri?.protocol) {
    case "http:":
    case "https:":
      return callHttpTool(uri, args, extras);
    case "mcp:":
      const decoded = decodeMCPToolUri(uri);
      if (!decoded) {
        throw new Error(`Invalid MCP tool URI: ${uri}`);
      }
      const [mcpId, toolName] = decoded;
      const client = MCPManagerSingleton.getInstance().getConnection(mcpId);

      if (!client) {
        throw new Error("MCP connection not found");
      }
      const response = await client.client.callTool(
        {
          name: toolName,
          arguments: args,
        },
        CallToolResultSchema,
        { timeout: client.options.timeout },
      );

      if (response.isError === true) {
        throw new Error(JSON.stringify(response.content));
      }

      const contextItems: ContextItem[] = [];
      (response.content as any).forEach((item: any) => {
        if (item.type === "text") {
          contextItems.push({
            name: extras.tool.displayTitle,
            description: "Tool output",
            content: item.text,
            icon: extras.tool.faviconUrl,
          });
        } else if (item.type === "resource") {
          // TODO resource change subscribers https://modelcontextprotocol.io/docs/concepts/resources
          if (item.resource?.blob) {
            contextItems.push({
              name: extras.tool.displayTitle,
              description: "MCP Item Error",
              content:
                "Error: tool call received unsupported blob resource item",
              icon: extras.tool.faviconUrl,
            });
          }
          // TODO account for mimetype? // const mimeType = item.resource.mimeType
          // const uri = item.resource.uri;
          contextItems.push({
            name: extras.tool.displayTitle,
            description: "Tool output",
            content: item.resource.text,
            icon: extras.tool.faviconUrl,
          });
        } else {
          contextItems.push({
            name: extras.tool.displayTitle,
            description: "MCP Item Error",
            content: `Error: tool call received unsupported item of type "${item.type}"`,
            icon: extras.tool.faviconUrl,
          });
        }
      });
      return contextItems;
    default:
      throw new Error(`Unsupported protocol: ${parsedUri?.protocol}`);
  }
}

export async function callBuiltInTool(
  functionName: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  // Delegate Jira tools to specialized handlers
  const fn = functionName as BuiltInToolNames;
  const readJiraTools = new Set<BuiltInToolNames>([
    BuiltInToolNames.JiraGetStatus,
    BuiltInToolNames.JiraGetAssignee,
    BuiltInToolNames.JiraSearchIssues,
    BuiltInToolNames.JiraGetLastWorklog,
    BuiltInToolNames.JiraGetRequirement,
    BuiltInToolNames.JiraGetDescriptionText,
    BuiltInToolNames.JiraGetLabels,
    BuiltInToolNames.JiraSearchWithJql,
    BuiltInToolNames.JiraGetIssueAttachments,
    BuiltInToolNames.JiraFindSubtasksByActivityType,
    BuiltInToolNames.JiraGetDueDate,
    BuiltInToolNames.JiraGetPlannedStartDate,
    BuiltInToolNames.JiraGetPlannedEndDate,
    BuiltInToolNames.JiraGetAcceptanceCriteria,
    BuiltInToolNames.JiraGetFixVersions,
    BuiltInToolNames.JiraGetProjectVersions,
  ]);

  const createJiraTools = new Set<BuiltInToolNames>([
    BuiltInToolNames.JiraCreateEpic,
    BuiltInToolNames.JiraCreateFeature,
    BuiltInToolNames.JiraCreateStory,
    BuiltInToolNames.JiraCreateSubtask,
    BuiltInToolNames.JiraSetDependency,
  ]);

  // Delegate Confluence tools to specialized handlers
  const readConfluenceTools = new Set<BuiltInToolNames>([
    BuiltInToolNames.ConfluenceSearchCQL,
    BuiltInToolNames.ConfluenceListSpaces,
    BuiltInToolNames.ConfluenceGetSpaceDetails,
    BuiltInToolNames.ConfluenceListPages,
    BuiltInToolNames.ConfluenceGetPageDetails,
    BuiltInToolNames.ConfluenceGetPageContent,
  ]);

  const mutatingConfluenceTools = new Set<BuiltInToolNames>([
    BuiltInToolNames.ConfluenceCreatePage,
    BuiltInToolNames.ConfluenceAddDiagram,
    BuiltInToolNames.ConfluenceModifyPageContent,
    BuiltInToolNames.ConfluenceAddPageLabel,
  ]);

  if (readJiraTools.has(fn)) {
    return await handleJiraQueryTools(fn, args, extras);
  }
  if (createJiraTools.has(fn)) {
    return await handleJiraCreateTools(fn, args, extras);
  }
  if (fn.toString().startsWith("jira_")) {
    return await handleJiraMutatingTools(fn, args, extras);
  }
  if (readConfluenceTools.has(fn)) {
    return await handleConfluenceQueryTools(fn, args, extras);
  }
  if (mutatingConfluenceTools.has(fn)) {
    return await handleConfluenceMutatingTools(fn, args, extras);
  }

  switch (functionName) {
    case BuiltInToolNames.ReadFile:
      return await readFileImpl(args, extras);
    case BuiltInToolNames.ReadFileRange:
      return await readFileRangeImpl(args, extras);
    case BuiltInToolNames.CreateNewFile:
      return await createNewFileImpl(args, extras);
    case BuiltInToolNames.GrepSearch:
      return await grepSearchImpl(args, extras);
    case BuiltInToolNames.FileGlobSearch:
      return await fileGlobSearchImpl(args, extras);
    case BuiltInToolNames.RunTerminalCommand:
      return await runTerminalCommandImpl(args, extras);
    case BuiltInToolNames.SearchWeb:
      return await searchWebImpl(args, extras);
    case BuiltInToolNames.FetchUrlContent:
      return await fetchUrlContentImpl(args, extras);
    case BuiltInToolNames.ViewDiff:
      return await viewDiffImpl(args, extras);
    case BuiltInToolNames.LSTool:
      return await lsToolImpl(args, extras);
    case BuiltInToolNames.ReadCurrentlyOpenFile:
      return await readCurrentlyOpenFileImpl(args, extras);
    case BuiltInToolNames.CreateRuleBlock:
      return await createRuleBlockImpl(args, extras);
    case BuiltInToolNames.RequestRule:
      return await requestRuleImpl(args, extras);
    case BuiltInToolNames.CodebaseTool:
      return await codebaseToolImpl(args, extras);
    case BuiltInToolNames.ViewRepoMap:
      return await viewRepoMapImpl(args, extras);
    case BuiltInToolNames.ViewSubdirectory:
      return await viewSubdirectoryImpl(args, extras);
    case BuiltInToolNames.FetchUrlChunk:
      return await fetchUrlChunkImpl(args, extras);
    case BuiltInToolNames.BrowserAction:
      return await browserActionImpl(args, extras);
    case BuiltInToolNames.ParsePdf:
      return await parsePdfImpl(args, extras);
    case BuiltInToolNames.ParseExcel:
      return await parseExcelImpl(args, extras);
    case BuiltInToolNames.ParseDocx:
      return await parseDocxImpl(args, extras);
    case BuiltInToolNames.ExtractEntities:
      return await extractEntitiesImpl(args, extras);
    case BuiltInToolNames.PlantumlBuilder:
      return await plantumlBuilderImpl(args, extras);
    default:
      throw new Error(`Tool "${functionName}" not found`);
  }
}

// Handles calls for core/non-client tools
// Returns an error context item if the tool call fails
// Note: Edit tool is handled on client
export async function callTool(
  tool: Tool,
  toolCall: ToolCall,
  extras: ToolExtras,
): Promise<{
  contextItems: ContextItem[];
  errorMessage: string | undefined;
}> {
  try {
    const args = safeParseToolCallArgs(toolCall);
    const contextItems = tool.uri
      ? await callToolFromUri(tool.uri, args, extras)
      : await callBuiltInTool(tool.function.name, args, extras);
    if (tool.faviconUrl) {
      contextItems.forEach((item) => {
        item.icon = tool.faviconUrl;
      });
    }
    return {
      contextItems,
      errorMessage: undefined,
    };
  } catch (e) {
    let errorMessage = `${e}`;
    if (e instanceof Error) {
      errorMessage = e.message;
    }
    return {
      contextItems: [],
      errorMessage,
    };
  }
}
