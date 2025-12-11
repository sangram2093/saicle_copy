import { ConfigDependentToolParams, Tool } from "..";
import * as toolDefinitions from "./definitions";

// I'm writing these as functions because we've messed up 3 TIMES by pushing to const, causing duplicate tool definitions on subsequent config loads.
export const getBaseToolDefinitions = () => [
  toolDefinitions.readFileTool,

  toolDefinitions.createNewFileTool,
  toolDefinitions.runTerminalCommandTool,
  toolDefinitions.globSearchTool,
  toolDefinitions.viewDiffTool,
  toolDefinitions.readCurrentlyOpenFileTool,
  toolDefinitions.lsTool,
  toolDefinitions.createRuleBlock,
  toolDefinitions.fetchUrlContentTool,
  toolDefinitions.browserActionTool,
  toolDefinitions.singleFindAndReplaceTool,

  toolDefinitions.fetchUrlChunkTool,
  toolDefinitions.jiraGetStatusTool,
  toolDefinitions.jiraGetAssigneeTool,
  toolDefinitions.jiraSearchIssuesTool,
  toolDefinitions.jiraTransitionIssueTool,
  toolDefinitions.jiraAddWorklogTool,
  toolDefinitions.jiraAddCommentTool,
  toolDefinitions.jiraMarkStartOfActivityTool,
  toolDefinitions.jiraMarkActivityCompletedTool,
  toolDefinitions.jiraAssignUserTool,
  toolDefinitions.jiraGetLastWorklogTool,
  toolDefinitions.jiraGetRequirementTool,
  toolDefinitions.jiraGetDescriptionTextTool,
  toolDefinitions.jiraSetDescriptionTextTool,
  toolDefinitions.jiraGetLabelsTool,
  toolDefinitions.jiraSetLabelsTool,
  toolDefinitions.jiraSetActivityTypeTool,
  toolDefinitions.jiraCreateEpicTool,
  toolDefinitions.jiraCreateFeatureTool,
  toolDefinitions.jiraCreateStoryTool,
  toolDefinitions.jiraCreateSubtaskTool,
  toolDefinitions.jiraSearchWithJqlTool,
  toolDefinitions.jiraSetDependencyTool,
  toolDefinitions.jiraGetIssueAttachmentsTool,
  toolDefinitions.jiraFindSubtasksByActivityTypeTool,
  toolDefinitions.jiraAddAttachmentTool,
  toolDefinitions.jiraGetDueDateTool,
  toolDefinitions.jiraSetDueDateTool,
  toolDefinitions.jiraGetPlannedStartDateTool,
  toolDefinitions.jiraSetPlannedStartDateTool,
  toolDefinitions.jiraGetPlannedEndDateTool,
  toolDefinitions.jiraSetPlannedEndDateTool,
  toolDefinitions.jiraGetAcceptanceCriteriaTool,
  toolDefinitions.jiraSetAcceptanceCriteriaTool,
  toolDefinitions.jiraGetFixVersionsTool,
  toolDefinitions.jiraGetProjectVersionsTool,
  toolDefinitions.jiraSetFixVersionsTool,
];

export const getConfigDependentToolDefinitions = (
  params: ConfigDependentToolParams,
): Tool[] => {
  const { modelName, isSignedIn, enableExperimentalTools, isRemote } = params;
  const tools: Tool[] = [];

  tools.push(toolDefinitions.requestRuleTool(params));

  if (isSignedIn) {
    // Web search is only available for signed-in users
    tools.push(toolDefinitions.searchWebTool);
  }

  if (enableExperimentalTools) {
    tools.push(
      toolDefinitions.viewRepoMapTool,
      toolDefinitions.viewSubdirectoryTool,
      toolDefinitions.codebaseTool,
      toolDefinitions.readFileRangeTool,
    );
  }

  if (modelName?.includes("claude") || modelName?.includes("gpt-5")) {
    tools.push(toolDefinitions.multiEditTool);
  } else {
    tools.push(toolDefinitions.editFileTool);
  }

  // missing support for remote os calls: https://github.com/microsoft/vscode/issues/252269
  if (!isRemote) {
    tools.push(toolDefinitions.grepSearchTool);
  }

  return tools;
};
