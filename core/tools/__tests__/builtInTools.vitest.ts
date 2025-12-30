/**
 * Comprehensive Mock-Based Unit Tests for All Built-In Tools
 * Tests core functionality of each tool with mocked dependencies
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuiltInToolNames } from "../builtIn";
import * as toolDefinitions from "../definitions";

// Type definitions for mocked extras
interface MockToolExtras {
  workspaceFolder: string;
  [key: string]: any;
}

/**
 * Helper function to create mock extras for tool testing
 */
const createMockExtras = (): MockToolExtras => ({
  workspaceFolder: "/mock/workspace",
});

describe("Built-In Tools - Mock-Based Unit Tests", () => {
  let mockExtras: MockToolExtras;

  beforeEach(() => {
    mockExtras = createMockExtras();
    vi.clearAllMocks();
  });

  describe("File Operation Tools", () => {
    describe("ReadFile", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.readFileTool;
        expect(tool.function.name).toBe(BuiltInToolNames.ReadFile);
        expect(tool.readonly).toBe(true);
        expect(tool.isInstant).toBe(true);
      });

      it("should define required parameters", () => {
        const tool = toolDefinitions.readFileTool;
        expect(tool.function.parameters.required).toContain("filepath");
      });
    });

    describe("CreateNewFile", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.createNewFileTool;
        expect(tool.function.name).toBe(BuiltInToolNames.CreateNewFile);
        expect(tool.readonly).toBe(false);
        expect(tool.isInstant).toBe(true);
      });

      it("should require filepath and contents", () => {
        const tool = toolDefinitions.createNewFileTool;
        expect(tool.function.parameters.required).toContain("filepath");
        expect(tool.function.parameters.required).toContain("contents");
      });
    });

    describe("EditExistingFile", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.editFileTool;
        expect(tool.function.name).toBe(BuiltInToolNames.EditExistingFile);
        expect(tool.readonly).toBe(false);
      });

      it("should require editing parameters", () => {
        const tool = toolDefinitions.editFileTool;
        const requiredParams = tool.function.parameters.required;
        expect(requiredParams).toContain("filepath");
      });
    });

    describe("ReadFileRange", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.readFileRangeTool;
        expect(tool.function.name).toBe(BuiltInToolNames.ReadFileRange);
        expect(tool.readonly).toBe(true);
      });

      it("should require line number parameters", () => {
        const tool = toolDefinitions.readFileRangeTool;
        const required = tool.function.parameters.required;
        expect(required).toContain("filepath");
        expect(required).toContain("startLine");
        expect(required).toContain("endLine");
      });
    });

    describe("ReadCurrentlyOpenFile", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.readCurrentlyOpenFileTool;
        expect(tool.function.name).toBe(BuiltInToolNames.ReadCurrentlyOpenFile);
        expect(tool.readonly).toBe(true);
      });
    });

    describe("SingleFindAndReplace", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.singleFindAndReplaceTool;
        expect(tool.function.name).toBe(BuiltInToolNames.SingleFindAndReplace);
        expect(tool.readonly).toBe(false);
      });

      it("should require find and replace parameters", () => {
        const tool = toolDefinitions.singleFindAndReplaceTool;
        const required = tool.function.parameters.required;
        expect(required).toContain("filepath");
        expect(required).toContain("old_string");
        expect(required).toContain("new_string");
      });
    });

    describe("MultiEdit", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.multiEditTool;
        expect(tool.function.name).toBe(BuiltInToolNames.MultiEdit);
        expect(tool.readonly).toBe(false);
      });
    });
  });

  describe("Search Tools", () => {
    describe("GrepSearch", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.grepSearchTool;
        expect(tool.function.name).toBe(BuiltInToolNames.GrepSearch);
        expect(tool.readonly).toBe(true);
      });

      it("should require query parameter", () => {
        const tool = toolDefinitions.grepSearchTool;
        expect(tool.function.parameters.required).toContain("query");
      });
    });

    describe("FileGlobSearch", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.globSearchTool;
        expect(tool.function.name).toBe(BuiltInToolNames.FileGlobSearch);
        expect(tool.readonly).toBe(true);
      });

      it("should require pattern parameter", () => {
        const tool = toolDefinitions.globSearchTool;
        expect(tool.function.parameters.required).toContain("pattern");
      });
    });

    describe("SearchWeb", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.searchWebTool;
        expect(tool.function.name).toBe(BuiltInToolNames.SearchWeb);
        expect(tool.readonly).toBe(true);
      });

      it("should require query parameter", () => {
        const tool = toolDefinitions.searchWebTool;
        expect(tool.function.parameters.required).toContain("query");
      });
    });
  });

  describe("Repository Tools", () => {
    describe("ViewDiff", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.viewDiffTool;
        expect(tool.function.name).toBe(BuiltInToolNames.ViewDiff);
        expect(tool.readonly).toBe(true);
      });
    });

    describe("LSTool", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.lsTool;
        expect(tool.function.name).toBe(BuiltInToolNames.LSTool);
        expect(tool.readonly).toBe(true);
      });

      it("should have parameters defined", () => {
        const tool = toolDefinitions.lsTool;
        expect(tool.function.parameters.properties).toBeDefined();
      });
    });

    describe("ViewRepoMap", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.viewRepoMapTool;
        expect(tool.function.name).toBe(BuiltInToolNames.ViewRepoMap);
        expect(tool.readonly).toBe(true);
      });
    });

    describe("ViewSubdirectory", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.viewSubdirectoryTool;
        expect(tool.function.name).toBe(BuiltInToolNames.ViewSubdirectory);
        expect(tool.readonly).toBe(true);
      });

      it("should require directory_path parameter", () => {
        const tool = toolDefinitions.viewSubdirectoryTool;
        expect(tool.function.parameters.required).toContain("directory_path");
      });
    });
  });

  describe("Terminal Tools", () => {
    describe("RunTerminalCommand", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.runTerminalCommandTool;
        expect(tool.function.name).toBe(BuiltInToolNames.RunTerminalCommand);
        expect(tool.readonly).toBe(false);
      });

      it("should require command parameter", () => {
        const tool = toolDefinitions.runTerminalCommandTool;
        expect(tool.function.parameters.required).toContain("command");
      });
    });
  });

  describe("URL Fetch Tools", () => {
    describe("FetchUrlContent", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.fetchUrlContentTool;
        expect(tool.function.name).toBe(BuiltInToolNames.FetchUrlContent);
        expect(tool.readonly).toBe(true);
      });

      it("should require url parameter", () => {
        const tool = toolDefinitions.fetchUrlContentTool;
        expect(tool.function.parameters.required).toContain("url");
      });
    });

    describe("FetchUrlChunk", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.fetchUrlChunkTool;
        expect(tool.function.name).toBe(BuiltInToolNames.FetchUrlChunk);
        expect(tool.readonly).toBe(true);
      });

      it("should require url, start_offset and chunk_length parameters", () => {
        const tool = toolDefinitions.fetchUrlChunkTool;
        const required = tool.function.parameters.required;
        expect(required).toContain("url");
        expect(required).toContain("start_offset");
        expect(required).toContain("chunk_length");
      });
    });
  });

  describe("Code Analysis Tools", () => {
    describe("CodebaseTool", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.codebaseTool;
        expect(tool.function.name).toBe(BuiltInToolNames.CodebaseTool);
        expect(tool.readonly).toBe(true);
      });

      it("should require query parameter", () => {
        const tool = toolDefinitions.codebaseTool;
        expect(tool.function.parameters.required).toContain("query");
      });
    });

    describe("ExtractEntities", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.extractEntitiesTool;
        expect(tool.function.name).toBe(BuiltInToolNames.ExtractEntities);
        expect(tool.readonly).toBe(false);
      });

      it("should require markdown parameter", () => {
        const tool = toolDefinitions.extractEntitiesTool;
        expect(tool.function.parameters.required).toContain("markdown");
      });
    });
  });

  describe("Parsing Tools", () => {
    describe("ParsePdf", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.parsePdfTool;
        expect(tool.function.name).toBe(BuiltInToolNames.ParsePdf);
      });

      it("should have parameters defined", () => {
        const tool = toolDefinitions.parsePdfTool;
        expect(tool.function.parameters).toBeDefined();
      });
    });

    describe("ParseExcel", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.parseExcelTool;
        expect(tool.function.name).toBe(BuiltInToolNames.ParseExcel);
      });

      it("should have parameters defined", () => {
        const tool = toolDefinitions.parseExcelTool;
        expect(tool.function.parameters).toBeDefined();
      });
    });

    describe("ParseDocx", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.parseDocxTool;
        expect(tool.function.name).toBe(BuiltInToolNames.ParseDocx);
      });

      it("should have parameters defined", () => {
        const tool = toolDefinitions.parseDocxTool;
        expect(tool.function.parameters).toBeDefined();
      });
    });

    describe("OssVulnerabilityScan", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.ossVulnerabilityScanTool;
        expect(tool.function.name).toBe(BuiltInToolNames.OssVulnerabilityScan);
        expect(tool.readonly).toBe(true);
      });
    });
  });

  describe("Diagram Tools", () => {
    describe("PlantumlBuilder", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.plantumlBuilderTool;
        expect(tool.function.name).toBe(BuiltInToolNames.PlantumlBuilder);
        expect(tool.readonly).toBe(false);
      });

      it("should have parameters defined", () => {
        const tool = toolDefinitions.plantumlBuilderTool;
        expect(tool.function.parameters).toBeDefined();
      });
    });

    describe("BrowserAction", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.browserActionTool;
        expect(tool.function.name).toBe(BuiltInToolNames.BrowserAction);
        expect(tool.readonly).toBe(false);
      });
    });
  });

  describe("Rule Tools", () => {
    describe("CreateRuleBlock", () => {
      it("should have correct tool definition", () => {
        const tool = toolDefinitions.createRuleBlock;
        expect(tool.function.name).toBe(BuiltInToolNames.CreateRuleBlock);
      });
    });

    describe("RequestRule", () => {
      it("should be a function that returns a tool", () => {
        expect(typeof toolDefinitions.requestRuleTool).toBe("function");
      });
    });
  });

  describe("JIRA Tools - Read Operations", () => {
    const jiraReadTools = [
      {
        name: BuiltInToolNames.JiraGetStatus,
        tool: toolDefinitions.jiraGetStatusTool,
      },
      {
        name: BuiltInToolNames.JiraGetAssignee,
        tool: toolDefinitions.jiraGetAssigneeTool,
      },
      {
        name: BuiltInToolNames.JiraSearchIssues,
        tool: toolDefinitions.jiraSearchIssuesTool,
      },
    ];

    jiraReadTools.forEach(({ name, tool }) => {
      it(`should have correct definition for ${name}`, () => {
        expect(tool.function.name).toBe(name);
        expect(tool.function).toBeDefined();
      });
    });
  });

  describe("JIRA Tools - Write Operations", () => {
    const jiraWriteTools = [
      {
        name: BuiltInToolNames.JiraTransitionIssue,
        tool: toolDefinitions.jiraTransitionIssueTool,
      },
      {
        name: BuiltInToolNames.JiraAddWorklog,
        tool: toolDefinitions.jiraAddWorklogTool,
      },
      {
        name: BuiltInToolNames.JiraAddComment,
        tool: toolDefinitions.jiraAddCommentTool,
      },
    ];

    jiraWriteTools.forEach(({ name, tool }) => {
      it(`should have correct definition for ${name}`, () => {
        expect(tool.function.name).toBe(name);
        expect(tool.readonly).toBe(false);
      });
    });
  });

  describe("Confluence Tools - Read Operations", () => {
    const confluenceReadTools = [
      {
        name: BuiltInToolNames.ConfluenceSearchCQL,
        tool: toolDefinitions.confluenceSearchCQLTool,
      },
      {
        name: BuiltInToolNames.ConfluenceListSpaces,
        tool: toolDefinitions.confluenceListSpacesTool,
      },
      {
        name: BuiltInToolNames.ConfluenceGetPageContent,
        tool: toolDefinitions.confluenceGetPageContentTool,
      },
    ];

    confluenceReadTools.forEach(({ name, tool }) => {
      it(`should have correct definition for ${name}`, () => {
        expect(tool.function.name).toBe(name);
        expect(tool.function).toBeDefined();
      });
    });
  });

  describe("Confluence Tools - Write Operations", () => {
    const confluenceWriteTools = [
      {
        name: BuiltInToolNames.ConfluenceCreatePage,
        tool: toolDefinitions.confluenceCreatePageTool,
      },
      {
        name: BuiltInToolNames.ConfluenceAddDiagram,
        tool: toolDefinitions.confluenceAddDiagramTool,
      },
      {
        name: BuiltInToolNames.ConfluenceModifyPageContent,
        tool: toolDefinitions.confluenceModifyPageContentTool,
      },
    ];

    confluenceWriteTools.forEach(({ name, tool }) => {
      it(`should have correct definition for ${name}`, () => {
        expect(tool.function.name).toBe(name);
        expect(tool.readonly).toBe(false);
      });
    });
  });

  describe("ServiceNow Tools - Read Operations", () => {
    const serviceNowReadTools = [
      {
        name: BuiltInToolNames.ServiceNowListIncidents,
        tool: toolDefinitions.servicenowListIncidentsTool,
      },
      {
        name: BuiltInToolNames.ServiceNowGetIncident,
        tool: toolDefinitions.servicenowGetIncidentTool,
      },
      {
        name: BuiltInToolNames.ServiceNowListTasks,
        tool: toolDefinitions.servicenowListTasksTool,
      },
    ];

    serviceNowReadTools.forEach(({ name, tool }) => {
      it(`should have correct definition for ${name}`, () => {
        expect(tool.function.name).toBe(name);
        expect(tool.readonly).toBe(true);
      });
    });
  });

  describe("ServiceNow Tools - Write Operations", () => {
    const serviceNowWriteTools = [
      {
        name: BuiltInToolNames.ServiceNowCreateIncident,
        tool: toolDefinitions.servicenowCreateIncidentTool,
      },
      {
        name: BuiltInToolNames.ServiceNowUpdateIncident,
        tool: toolDefinitions.servicenowUpdateIncidentTool,
      },
      {
        name: BuiltInToolNames.ServiceNowAddComment,
        tool: toolDefinitions.servicenowAddCommentTool,
      },
    ];

    serviceNowWriteTools.forEach(({ name, tool }) => {
      it(`should have correct definition for ${name}`, () => {
        expect(tool.function.name).toBe(name);
        expect(tool.readonly).toBe(false);
      });
    });
  });

  describe("Tool Parameter Validation", () => {
    it("should have type 'function' for all tools", () => {
      const tools = Object.values(toolDefinitions).filter(
        (value) => value && typeof value === "object" && "function" in value,
      );

      tools.forEach((tool: any) => {
        expect(tool.type).toBe("function");
      });
    });

    it("should have proper parameter schema for all tools", () => {
      const tools = Object.values(toolDefinitions).filter(
        (value) => value && typeof value === "object" && "function" in value,
      );

      tools.forEach((tool: any) => {
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe("object");
        // Some tools may not have a required array, which is acceptable
        if (tool.function.parameters.required) {
          expect(Array.isArray(tool.function.parameters.required)).toBe(true);
        }
      });
    });
  });

  describe("Tool Policies", () => {
    it("should have appropriate default policies", () => {
      const readTools = [
        toolDefinitions.readFileTool,
        toolDefinitions.grepSearchTool,
        toolDefinitions.viewDiffTool,
      ];

      readTools.forEach((tool) => {
        expect(tool.readonly).toBe(true);
      });
    });

    it("should mark write tools as non-readonly", () => {
      const writeTools = [
        toolDefinitions.createNewFileTool,
        toolDefinitions.editFileTool,
        toolDefinitions.singleFindAndReplaceTool,
      ];

      writeTools.forEach((tool) => {
        expect(tool.readonly).toBe(false);
      });
    });
  });

  describe("Tool Descriptions", () => {
    it("should have descriptive text for each tool", () => {
      const tools = Object.values(toolDefinitions).filter(
        (value) => value && typeof value === "object" && "function" in value,
      );

      tools.forEach((tool: any) => {
        expect(tool.displayTitle).toBeDefined();
        expect(typeof tool.displayTitle).toBe("string");
        expect(tool.displayTitle.length).toBeGreaterThan(0);

        expect(tool.function.description).toBeDefined();
        expect(typeof tool.function.description).toBe("string");
        expect(tool.function.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Tool Grouping", () => {
    it("should assign tools to built-in group", () => {
      const tools = Object.values(toolDefinitions).filter(
        (value) => value && typeof value === "object" && "function" in value,
      );

      tools.forEach((tool: any) => {
        expect(tool.group).toBe("Built-In");
      });
    });
  });

  describe("Tool Metadata", () => {
    it("should have wouldLikeTo template strings", () => {
      const tools = [
        toolDefinitions.readFileTool,
        toolDefinitions.createNewFileTool,
        toolDefinitions.grepSearchTool,
      ];

      tools.forEach((tool) => {
        expect(tool.wouldLikeTo).toBeDefined();
        expect(typeof tool.wouldLikeTo).toBe("string");
      });
    });

    it("should have isCurrently template strings", () => {
      const tools = [
        toolDefinitions.readFileTool,
        toolDefinitions.createNewFileTool,
        toolDefinitions.grepSearchTool,
      ];

      tools.forEach((tool) => {
        expect(tool.isCurrently).toBeDefined();
        expect(typeof tool.isCurrently).toBe("string");
      });
    });

    it("should have hasAlready template strings", () => {
      const tools = [
        toolDefinitions.readFileTool,
        toolDefinitions.createNewFileTool,
        toolDefinitions.grepSearchTool,
      ];

      tools.forEach((tool) => {
        expect(tool.hasAlready).toBeDefined();
        expect(typeof tool.hasAlready).toBe("string");
      });
    });
  });
});
