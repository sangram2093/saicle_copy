import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

const jiraBase: Partial<Tool> = {
  type: "function",
  readonly: false,
  isInstant: false,
  group: BUILT_IN_GROUP_NAME,
  defaultToolPolicy: "allowedWithPermission",
};

export const jiraGetStatusTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Issue Status",
  wouldLikeTo: "get the Jira issue status for {{{ issueKey }}}",
  isCurrently: "retrieving Jira issue status",
  hasAlready: "retrieved Jira issue status",
  function: {
    name: BuiltInToolNames.JiraGetStatus,
    description: "Get Jira issue status",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: {
        issueKey: { type: "string" },
      },
    },
  },
};

export const jiraGetAssigneeTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Assignee",
  wouldLikeTo: "get the assignee for {{{ issueKey }}}",
  isCurrently: "retrieving Jira issue assignee",
  hasAlready: "retrieved Jira issue assignee",
  function: {
    name: BuiltInToolNames.JiraGetAssignee,
    description: "Get Jira issue assignee",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: { issueKey: { type: "string" } },
    },
  },
};

export const jiraSearchIssuesTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Search Issues",
  wouldLikeTo: "search Jira issues for {{{ query }}}",
  isCurrently: "searching Jira",
  hasAlready: "searched Jira",
  function: {
    name: BuiltInToolNames.JiraSearchIssues,
    description: "Search Jira issues by text",
    parameters: {
      type: "object",
      required: ["query"],
      properties: { query: { type: "string" } },
    },
  },
};

export const jiraTransitionIssueTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Transition Issue",
  wouldLikeTo: "transition issue {{{ issueKey }}} to {{{ transitionName }}}",
  isCurrently: "transitioning Jira issue",
  hasAlready: "transitioned Jira issue",
  function: {
    name: BuiltInToolNames.JiraTransitionIssue,
    description: "Transition a Jira issue to a new state",
    parameters: {
      type: "object",
      required: ["issueKey", "transitionName"],
      properties: {
        issueKey: { type: "string" },
        transitionName: { type: "string" },
      },
    },
  },
};

export const jiraAddWorklogTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Add Worklog",
  wouldLikeTo: "add a worklog to {{{ issueKey }}}",
  isCurrently: "adding worklog",
  hasAlready: "added worklog",
  function: {
    name: BuiltInToolNames.JiraAddWorklog,
    description: "Add a worklog entry to a Jira issue",
    parameters: {
      type: "object",
      required: ["issueKey", "timeSpent"],
      properties: {
        issueKey: { type: "string" },
        timeSpent: { type: "string" },
        comment: { type: "string" },
      },
    },
  },
};

export const jiraAddCommentTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Add Comment",
  wouldLikeTo: "add a comment to {{{ issueKey }}}",
  isCurrently: "adding comment",
  hasAlready: "added comment",
  function: {
    name: BuiltInToolNames.JiraAddComment,
    description: "Add a comment to a Jira issue",
    parameters: {
      type: "object",
      required: ["issueKey", "comment"],
      properties: { issueKey: { type: "string" }, comment: { type: "string" } },
    },
  },
};

export const jiraAssignUserTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Assign User",
  wouldLikeTo: "assign user {{{ username }}} to {{{ issueKey }}}",
  isCurrently: "assigning user",
  hasAlready: "assigned user",
  function: {
    name: BuiltInToolNames.JiraAssignUser,
    description: "Assign a user to a Jira issue",
    parameters: {
      type: "object",
      required: ["issueKey", "username"],
      properties: {
        issueKey: { type: "string" },
        username: { type: "string" },
      },
    },
  },
};

export const jiraGetLastWorklogTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Last Worklog",
  wouldLikeTo: "get the last worklog for {{{ issueKey }}}",
  isCurrently: "retrieving last worklog",
  hasAlready: "retrieved last worklog",
  function: {
    name: BuiltInToolNames.JiraGetLastWorklog,
    description: "Get last worklog entry for a Jira issue",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: { issueKey: { type: "string" } },
    },
  },
};

export const jiraGetRequirementTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Requirement from Jira",
  wouldLikeTo:
    "get the description, acceptance criteria and attachments for {{{ issueKey }}}",
  isCurrently: "retrieving description, acceptance criteria and attachments",
  hasAlready: "retrieved description, acceptance criteria and attachments",
  function: {
    name: BuiltInToolNames.JiraGetRequirement,
    description:
      "Get Jira issue description, acceptance criteria and attachments",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: { issueKey: { type: "string" } },
    },
  },
};

export const jiraGetDescriptionTextTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Description Text",
  wouldLikeTo: "get the text description for {{{ issueKey }}}",
  isCurrently: "retrieving description text",
  hasAlready: "retrieved description text",
  function: {
    name: BuiltInToolNames.JiraGetDescriptionText,
    description: "Get Jira issue description text",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: { issueKey: { type: "string" } },
    },
  },
};

export const jiraSetDescriptionTextTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Set Description Text",
  wouldLikeTo: "set the description for {{{ issueKey }}}",
  isCurrently: "updating description",
  hasAlready: "updated description",
  function: {
    name: BuiltInToolNames.JiraSetDescriptionText,
    description: "Set Jira issue description text",
    parameters: {
      type: "object",
      required: ["issueKey", "description"],
      properties: {
        issueKey: { type: "string" },
        description: { type: "string" },
      },
    },
  },
};

export const jiraGetLabelsTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Labels",
  wouldLikeTo: "get labels for {{{ issueKey }}}",
  isCurrently: "retrieving labels",
  hasAlready: "retrieved labels",
  function: {
    name: BuiltInToolNames.JiraGetLabels,
    description: "Get Jira issue labels",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: { issueKey: { type: "string" } },
    },
  },
};

export const jiraSetLabelsTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Set Labels",
  wouldLikeTo: "set labels for {{{ issueKey }}}",
  isCurrently: "updating labels",
  hasAlready: "updated labels",
  function: {
    name: BuiltInToolNames.JiraSetLabels,
    description: "Set Jira issue labels",
    parameters: {
      type: "object",
      required: ["issueKey", "labels"],
      properties: {
        issueKey: { type: "string" },
        labels: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export const jiraSetActivityTypeTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Set Activity Type",
  wouldLikeTo: "set activity type for {{{ issueKey }}}",
  isCurrently: "updating activity type",
  hasAlready: "updated activity type",
  function: {
    name: BuiltInToolNames.JiraSetActivityType,
    description: "Set custom field 'Activity Type' for Jira issue",
    parameters: {
      type: "object",
      required: ["issueKey", "activityType"],
      properties: {
        issueKey: { type: "string" },
        activityType: { type: "string" },
      },
    },
  },
};

export const jiraCreateEpicTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Create Epic",
  wouldLikeTo: "create an epic in project {{{ projectKey }}}",
  isCurrently: "creating epic",
  hasAlready: "created epic",
  function: {
    name: BuiltInToolNames.JiraCreateEpic,
    description: "Create an Epic",
    parameters: {
      type: "object",
      required: ["projectKey", "summary", "description", "epicName"],
      properties: {
        projectKey: { type: "string" },
        summary: { type: "string" },
        description: { type: "string" },
        epicName: { type: "string" },
      },
    },
  },
};

export const jiraCreateFeatureTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Create Feature",
  wouldLikeTo: "create a feature in project {{{ projectKey }}}",
  isCurrently: "creating feature",
  hasAlready: "created feature",
  function: {
    name: BuiltInToolNames.JiraCreateFeature,
    description: "Create a Feature linked to an Epic",
    parameters: {
      type: "object",
      required: ["projectKey", "summary", "description", "epicLink"],
      properties: {
        projectKey: { type: "string" },
        summary: { type: "string" },
        description: { type: "string" },
        epicLink: { type: "string" },
      },
    },
  },
};

export const jiraCreateStoryTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Create Story",
  wouldLikeTo: "create a story in project {{{ projectKey }}}",
  isCurrently: "creating story",
  hasAlready: "created story",
  function: {
    name: BuiltInToolNames.JiraCreateStory,
    description: "Create a Story",
    parameters: {
      type: "object",
      required: ["projectKey", "summary", "description"],
      properties: {
        projectKey: { type: "string" },
        summary: { type: "string" },
        description: { type: "string" },
      },
    },
  },
};

export const jiraCreateSubtaskTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Create Subtask",
  wouldLikeTo: "create a subtask under {{{ parentKey }}}",
  isCurrently: "creating subtask",
  hasAlready: "created subtask",
  function: {
    name: BuiltInToolNames.JiraCreateSubtask,
    description: "Create a Sub-task",
    parameters: {
      type: "object",
      required: ["projectKey", "parentKey", "summary", "description"],
      properties: {
        projectKey: { type: "string" },
        parentKey: { type: "string" },
        summary: { type: "string" },
        description: { type: "string" },
        activityType: { type: "string" },
      },
    },
  },
};

export const jiraSearchWithJqlTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Search (JQL)",
  wouldLikeTo: "search Jira using JQL {{{ jql }}}",
  isCurrently: "searching Jira",
  hasAlready: "searched Jira",
  function: {
    name: BuiltInToolNames.JiraSearchWithJql,
    description: "Search Jira with JQL",
    parameters: {
      type: "object",
      required: ["jql"],
      properties: { jql: { type: "string" } },
    },
  },
};

export const jiraSetDependencyTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Set Dependency",
  wouldLikeTo: "link {{{ inward }}} to {{{ outward }}} as {{{ type }}}",
  isCurrently: "creating dependency link",
  hasAlready: "created dependency link",
  function: {
    name: BuiltInToolNames.JiraSetDependency,
    description: "Create an issue link between two Jira issues",
    parameters: {
      type: "object",
      required: ["inwardIssueKey", "outwardIssueKey", "linkType"],
      properties: {
        inwardIssueKey: { type: "string" },
        outwardIssueKey: { type: "string" },
        linkType: { type: "string" },
      },
    },
  },
};

export const jiraGetIssueAttachmentsTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Attachments",
  wouldLikeTo: "list attachments for {{{ issueKey }}}",
  isCurrently: "retrieving attachments",
  hasAlready: "retrieved attachments",
  function: {
    name: BuiltInToolNames.JiraGetIssueAttachments,
    description: "Get issue attachments",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: { issueKey: { type: "string" } },
    },
  },
};

export const jiraFindSubtasksByActivityTypeTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Find Subtasks by Activity Type",
  wouldLikeTo:
    "find subtasks under {{{ parentKey }}} with activity {{{ activity }}}",
  isCurrently: "searching subtasks",
  hasAlready: "found subtasks",
  function: {
    name: BuiltInToolNames.JiraFindSubtasksByActivityType,
    description: "Find subtasks by Activity Type",
    parameters: {
      type: "object",
      required: ["parentIssueKey", "activityType"],
      properties: {
        parentIssueKey: { type: "string" },
        activityType: { type: "string" },
      },
    },
  },
};

export const jiraAddAttachmentTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Add Attachment",
  wouldLikeTo: "add attachment to {{{ issueKey }}}",
  isCurrently: "adding attachment",
  hasAlready: "added attachment",
  function: {
    name: BuiltInToolNames.JiraAddAttachment,
    description: "Add an attachment to a Jira issue",
    parameters: {
      type: "object",
      required: ["issueKey", "filepath"],
      properties: {
        issueKey: { type: "string" },
        filepath: { type: "string" },
      },
    },
  },
};

export const jiraGetDueDateTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Due Date",
  wouldLikeTo: "get due date for {{{ issueKey }}}",
  isCurrently: "retrieving due date",
  hasAlready: "retrieved due date",
  function: {
    name: BuiltInToolNames.JiraGetDueDate,
    description: "Get issue due date",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: { issueKey: { type: "string" } },
    },
  },
};

export const jiraSetDueDateTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Set Due Date",
  wouldLikeTo: "set due date for {{{ issueKey }}}",
  isCurrently: "updating due date",
  hasAlready: "updated due date",
  function: {
    name: BuiltInToolNames.JiraSetDueDate,
    description: "Set issue due date",
    parameters: {
      type: "object",
      required: ["issueKey", "dueDate"],
      properties: { issueKey: { type: "string" }, dueDate: { type: "string" } },
    },
  },
};

export const jiraGetPlannedStartDateTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Planned Start",
  wouldLikeTo: "get planned start for {{{ issueKey }}}",
  isCurrently: "retrieving planned start",
  hasAlready: "retrieved planned start",
  function: {
    name: BuiltInToolNames.JiraGetPlannedStartDate,
    description: "Get planned start date custom field",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: { issueKey: { type: "string" } },
    },
  },
};

export const jiraSetPlannedStartDateTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Set Planned Start",
  wouldLikeTo: "set planned start for {{{ issueKey }}}",
  isCurrently: "updating planned start",
  hasAlready: "updated planned start",
  function: {
    name: BuiltInToolNames.JiraSetPlannedStartDate,
    description: "Set planned start date custom field",
    parameters: {
      type: "object",
      required: ["issueKey", "startDate"],
      properties: {
        issueKey: { type: "string" },
        startDate: { type: "string" },
      },
    },
  },
};

export const jiraGetPlannedEndDateTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Planned End",
  wouldLikeTo: "get planned end for {{{ issueKey }}}",
  isCurrently: "retrieving planned end",
  hasAlready: "retrieved planned end",
  function: {
    name: BuiltInToolNames.JiraGetPlannedEndDate,
    description: "Get planned end date custom field",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: { issueKey: { type: "string" } },
    },
  },
};

export const jiraSetPlannedEndDateTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Set Planned End",
  wouldLikeTo: "set planned end for {{{ issueKey }}}",
  isCurrently: "updating planned end",
  hasAlready: "updated planned end",
  function: {
    name: BuiltInToolNames.JiraSetPlannedEndDate,
    description: "Set planned end date custom field",
    parameters: {
      type: "object",
      required: ["issueKey", "endDate"],
      properties: { issueKey: { type: "string" }, endDate: { type: "string" } },
    },
  },
};

export const jiraGetAcceptanceCriteriaTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Acceptance Criteria",
  wouldLikeTo: "get acceptance criteria for {{{ issueKey }}}",
  isCurrently: "retrieving acceptance criteria",
  hasAlready: "retrieved acceptance criteria",
  function: {
    name: BuiltInToolNames.JiraGetAcceptanceCriteria,
    description: "Get Acceptance Criteria custom field",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: { issueKey: { type: "string" } },
    },
  },
};

export const jiraSetAcceptanceCriteriaTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Set Acceptance Criteria",
  wouldLikeTo: "set acceptance criteria for {{{ issueKey }}}",
  isCurrently: "updating acceptance criteria",
  hasAlready: "updated acceptance criteria",
  function: {
    name: BuiltInToolNames.JiraSetAcceptanceCriteria,
    description: "Set Acceptance Criteria custom field",
    parameters: {
      type: "object",
      required: ["issueKey", "criteria"],
      properties: {
        issueKey: { type: "string" },
        criteria: { type: "string" },
      },
    },
  },
};

export const jiraGetFixVersionsTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Fix Versions",
  wouldLikeTo: "get fix versions for {{{ issueKey }}}",
  isCurrently: "retrieving fix versions",
  hasAlready: "retrieved fix versions",
  function: {
    name: BuiltInToolNames.JiraGetFixVersions,
    description: "Get issue fix versions",
    parameters: {
      type: "object",
      required: ["issueKey"],
      properties: { issueKey: { type: "string" } },
    },
  },
};

export const jiraGetProjectVersionsTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Get Project Versions",
  wouldLikeTo: "get versions for project {{{ projectKey }}}",
  isCurrently: "retrieving project versions",
  hasAlready: "retrieved project versions",
  function: {
    name: BuiltInToolNames.JiraGetProjectVersions,
    description: "Get project versions",
    parameters: {
      type: "object",
      required: ["projectKey"],
      properties: { projectKey: { type: "string" } },
    },
  },
};

export const jiraSetFixVersionsTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Set Fix Versions",
  wouldLikeTo: "set fix versions for {{{ issueKey }}}",
  isCurrently: "updating fix versions",
  hasAlready: "updated fix versions",
  function: {
    name: BuiltInToolNames.JiraSetFixVersions,
    description: "Set fix versions for an issue",
    parameters: {
      type: "object",
      required: ["issueKey", "versionNames"],
      properties: {
        issueKey: { type: "string" },
        versionNames: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export const jiraMarkStartOfActivityTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Mark Start of Activity",
  wouldLikeTo:
    "mark the start of activity {{{ activityName }}} for {{{ issueKey }}}",
  isCurrently: "marking activity start",
  hasAlready: "marked activity start",
  function: {
    name: BuiltInToolNames.JiraMarkStartOfActivity,
    description: "Mark the start of an activity with a timestamp comment",
    parameters: {
      type: "object",
      required: ["issueKey", "activityName"],
      properties: {
        issueKey: { type: "string" },
        activityName: { type: "string" },
      },
    },
  },
};

export const jiraMarkActivityCompletedTool: Tool = {
  ...(jiraBase as any),
  displayTitle: "Jira: Mark Activity Completed",
  wouldLikeTo:
    "mark activity {{{ activityName }}} as completed for {{{ issueKey }}}",
  isCurrently: "marking activity completed",
  hasAlready: "marked activity completed",
  function: {
    name: BuiltInToolNames.JiraMarkActivityCompleted,
    description: "Mark activity as completed with worklog and timestamp",
    parameters: {
      type: "object",
      required: ["issueKey", "activityName"],
      properties: {
        issueKey: { type: "string" },
        activityName: { type: "string" },
      },
    },
  },
};

export default {};
