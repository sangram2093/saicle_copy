import { ContextItem, ToolExtras } from "../..";
import { BuiltInToolNames } from "../builtIn";
import { getOptionalStringArg, getStringArg } from "../parseArgs";

import {
  jira_addAttachment,
  jira_addComment,
  jira_addWorklog,
  jira_assignUser,
  jira_createEpic,
  jira_createFeature,
  jira_createStory,
  jira_createSubtask,
  jira_findSubtasksByActivityType,
  jira_getAcceptanceCriteria,
  jira_getDueDate,
  jira_getFixVersionsForJiraIssue,
  jira_getIssueAttachments,
  jira_getJiraAssignee,
  jira_getJiraDescriptionText,
  jira_getJiraLabels,
  jira_getJiraRequirement,
  jira_getJiraStatus,
  jira_getLastWorklog,
  jira_getPlannedEndDate,
  jira_getPlannedStartDate,
  jira_getProjectVersions,
  jira_markActivityCompleted,
  jira_markStartOfActivity,
  jira_searchJiraIssues,
  jira_searchJiraIssuesWithJql,
  jira_setAcceptanceCriteria,
  jira_setDueDate,
  jira_setFixVersionsForJiraIssue,
  jira_setJiraActivityType,
  jira_setJiraDependency,
  jira_setJiraDescriptionText,
  jira_setJiraLabels,
  jira_setPlannedEndDate,
  jira_setPlannedStartDate,
  jira_transitionJiraIssue,
} from "../../JiraUtils";

// Query/read-only Jira tools
export async function handleJiraQueryTools(
  functionName: BuiltInToolNames,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  switch (functionName) {
    case BuiltInToolNames.JiraGetStatus: {
      const issueKey = getStringArg(args, "issueKey");
      const status = await jira_getJiraStatus(issueKey, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Jira status for ${issueKey}`,
          content: status ?? "Unknown",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraGetAssignee: {
      const issueKey = getStringArg(args, "issueKey");
      const assignee = await jira_getJiraAssignee(issueKey, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Jira assignee for ${issueKey}`,
          content: assignee ?? "Unassigned",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraSearchIssues: {
      const query = getStringArg(args, "query");
      const issues = await jira_searchJiraIssues(query, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Search results for: ${query}`,
          content: issues?.length
            ? JSON.stringify(issues, null, 2)
            : "No results",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraGetLastWorklog: {
      const issueKey = getStringArg(args, "issueKey");
      const worklog = await jira_getLastWorklog(issueKey, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Last worklog for ${issueKey}`,
          content: worklog
            ? JSON.stringify(worklog, null, 2)
            : "No worklogs found",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraGetRequirement: {
      const issueKey = getStringArg(args, "issueKey");
      const parts = await jira_getJiraRequirement(issueKey, extras.config);
      if (!parts?.length) {
        return [
          {
            name: extras.tool.displayTitle,
            description: `Requirement which consists of Description , acceptance criteria and attachments for ${issueKey}`,
            content: "complete requirement not found",
            icon: extras.tool.faviconUrl,
          },
        ];
      }
      return parts.map(
        (p: any) =>
          ({
            name: extras.tool.displayTitle,
            description: `Requirement for ${issueKey}`,
            content: p.text ?? p.buffer ?? JSON.stringify(p),
            icon: extras.tool.faviconUrl,
          }) as ContextItem,
      );
    }
    case BuiltInToolNames.JiraGetDescriptionText: {
      const issueKey = getStringArg(args, "issueKey");
      const text = await jira_getJiraDescriptionText(issueKey, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Description for ${issueKey}`,
          content: text ?? "No description",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraGetLabels: {
      const issueKey = getStringArg(args, "issueKey");
      const labels = await jira_getJiraLabels(issueKey, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Labels for ${issueKey}`,
          content: labels ? JSON.stringify(labels, null, 2) : "No labels",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraSearchWithJql: {
      const jql = getStringArg(args, "jql");
      const results = await jira_searchJiraIssuesWithJql(jql, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `JQL search results`,
          content: results ? JSON.stringify(results, null, 2) : "No results",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraGetIssueAttachments: {
      const issueKey = getStringArg(args, "issueKey");
      const atts = await jira_getIssueAttachments(issueKey, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Attachments for ${issueKey}`,
          content: atts ? JSON.stringify(atts, null, 2) : "No attachments",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraFindSubtasksByActivityType: {
      const parentKey = getStringArg(args, "parentIssueKey");
      const activity = getStringArg(args, "activityType");
      const found = await jira_findSubtasksByActivityType(
        parentKey,
        activity,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Subtasks for ${parentKey}`,
          content: found ? JSON.stringify(found, null, 2) : "No subtasks",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraGetDueDate: {
      const issueKey = getStringArg(args, "issueKey");
      const date = await jira_getDueDate(issueKey, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Due date for ${issueKey}`,
          content: date ?? "No due date",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraGetPlannedStartDate: {
      const issueKey = getStringArg(args, "issueKey");
      const date = await jira_getPlannedStartDate(issueKey, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Planned start for ${issueKey}`,
          content: date ?? "Not set",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraGetPlannedEndDate: {
      const issueKey = getStringArg(args, "issueKey");
      const date = await jira_getPlannedEndDate(issueKey, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Planned end for ${issueKey}`,
          content: date ?? "Not set",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraGetAcceptanceCriteria: {
      const issueKey = getStringArg(args, "issueKey");
      const criteria = await jira_getAcceptanceCriteria(
        issueKey,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Acceptance criteria for ${issueKey}`,
          content: criteria ?? "Not set",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraGetFixVersions: {
      const issueKey = getStringArg(args, "issueKey");
      const versions = await jira_getFixVersionsForJiraIssue(
        issueKey,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Fix versions for ${issueKey}`,
          content: versions ? JSON.stringify(versions, null, 2) : "None",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraGetProjectVersions: {
      const projectKey = getStringArg(args, "projectKey");
      const versions = await jira_getProjectVersions(projectKey, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Project versions for ${projectKey}`,
          content: versions ? JSON.stringify(versions, null, 2) : "None",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    default:
      throw new Error(`Unknown Jira query tool: ${functionName}`);
  }
}

// Mutating/create Jira tools
export async function handleJiraMutatingTools(
  functionName: BuiltInToolNames,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  switch (functionName) {
    case BuiltInToolNames.JiraTransitionIssue: {
      const issueKey = getStringArg(args, "issueKey");
      const transitionName = getStringArg(args, "transitionName");
      const success = await jira_transitionJiraIssue(
        issueKey,
        transitionName,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Transition ${issueKey} -> ${transitionName}`,
          content: success ? "Success" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraAddWorklog: {
      const issueKey = getStringArg(args, "issueKey");
      const timeSpent = getStringArg(args, "timeSpent");
      const comment = getOptionalStringArg(args, "comment", true) ?? "";
      const success = await jira_addWorklog(
        issueKey,
        timeSpent,
        comment,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Add worklog to ${issueKey}`,
          content: success ? "Added" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraAddComment: {
      const issueKey = getStringArg(args, "issueKey");
      const comment = getStringArg(args, "comment");
      const success = await jira_addComment(issueKey, comment, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Add comment to ${issueKey}`,
          content: success ? "Added" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraAssignUser: {
      const issueKey = getStringArg(args, "issueKey");
      const username = getStringArg(args, "username");
      const success = await jira_assignUser(issueKey, username, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Assign ${username} to ${issueKey}`,
          content: success ? "Assigned" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraSetDescriptionText: {
      const issueKey = getStringArg(args, "issueKey");
      const description = getStringArg(args, "description");
      const success = await jira_setJiraDescriptionText(
        issueKey,
        description,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Set description for ${issueKey}`,
          content: success ? "Updated" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraSetLabels: {
      const issueKey = getStringArg(args, "issueKey");
      const labels = args.labels as string[];
      const success = await jira_setJiraLabels(issueKey, labels, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Set labels for ${issueKey}`,
          content: success ? "Updated" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraSetActivityType: {
      const issueKey = getStringArg(args, "issueKey");
      const activityType = getStringArg(args, "activityType");
      const success = await jira_setJiraActivityType(
        issueKey,
        activityType,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Set activity type for ${issueKey}`,
          content: success ? "Updated" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraAddAttachment: {
      const issueKey = getStringArg(args, "issueKey");
      const filepath = getStringArg(args, "filepath");
      // here we are sending extra as args since its required for getting the workspace dir
      const success = await jira_addAttachment(issueKey, filepath, extras);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Add attachment to ${issueKey}`,
          content: success ? "Added" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraSetDueDate: {
      const issueKey = getStringArg(args, "issueKey");
      const dueDate = getStringArg(args, "dueDate");
      const success = await jira_setDueDate(issueKey, dueDate, extras.config);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Set due date for ${issueKey}`,
          content: success ? "Updated" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraSetPlannedStartDate: {
      const issueKey = getStringArg(args, "issueKey");
      const startDate = getStringArg(args, "startDate");
      const success = await jira_setPlannedStartDate(
        issueKey,
        startDate,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Set planned start for ${issueKey}`,
          content: success ? "Updated" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraSetPlannedEndDate: {
      const issueKey = getStringArg(args, "issueKey");
      const endDate = getStringArg(args, "endDate");
      const success = await jira_setPlannedEndDate(
        issueKey,
        endDate,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Set planned end for ${issueKey}`,
          content: success ? "Updated" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraSetAcceptanceCriteria: {
      const issueKey = getStringArg(args, "issueKey");
      const criteria = getStringArg(args, "criteria");
      const success = await jira_setAcceptanceCriteria(
        issueKey,
        criteria,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Set acceptance criteria for ${issueKey}`,
          content: success ? "Updated" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraSetFixVersions: {
      const issueKey = getStringArg(args, "issueKey");
      const versionNames = args.versionNames as string[];
      const success = await jira_setFixVersionsForJiraIssue(
        issueKey,
        versionNames,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Set fix versions for ${issueKey}`,
          content: success ? "Updated" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraMarkStartOfActivity: {
      const issueKey = getStringArg(args, "issueKey");
      const activityName = getStringArg(args, "activityName");
      const success = await jira_markStartOfActivity(
        issueKey,
        activityName,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Marked start of activity '${activityName}' for ${issueKey}`,
          content: success ? "Success" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraMarkActivityCompleted: {
      const issueKey = getStringArg(args, "issueKey");
      const activityName = getStringArg(args, "activityName");
      const success = await jira_markActivityCompleted(
        issueKey,
        activityName,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Marked activity '${activityName}' as completed for ${issueKey}`,
          content: success ? "Success" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    default:
      throw new Error(`Unknown Jira mutating tool: ${functionName}`);
  }
}

// Create tools (Epic, Feature, Story, Subtask, Dependency)
export async function handleJiraCreateTools(
  functionName: BuiltInToolNames,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  switch (functionName) {
    case BuiltInToolNames.JiraCreateEpic: {
      const projectKey = getStringArg(args, "projectKey");
      const summary = getStringArg(args, "summary");
      const description = getStringArg(args, "description");
      const epicName = getStringArg(args, "epicName");
      const key = await jira_createEpic(
        projectKey,
        summary,
        description,
        epicName,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Create epic in ${projectKey}`,
          content: key ?? "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraCreateFeature: {
      const projectKey = getStringArg(args, "projectKey");
      const summary = getStringArg(args, "summary");
      const description = getStringArg(args, "description");
      const epicLink = getStringArg(args, "epicLink");
      const key = await jira_createFeature(
        projectKey,
        summary,
        description,
        epicLink,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Create feature in ${projectKey}`,
          content: key ?? "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraCreateStory: {
      const projectKey = getStringArg(args, "projectKey");
      const summary = getStringArg(args, "summary");
      const description = getStringArg(args, "description");
      const key = await jira_createStory(
        projectKey,
        summary,
        description,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Create story in ${projectKey}`,
          content: key ?? "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraCreateSubtask: {
      const projectKey = getStringArg(args, "projectKey");
      const parentKey = getStringArg(args, "parentKey");
      const summary = getStringArg(args, "summary");
      const description = getStringArg(args, "description");
      const activityType =
        getOptionalStringArg(args, "activityType", true) ?? undefined;
      const key = await jira_createSubtask(
        projectKey,
        parentKey,
        summary,
        description,
        activityType,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Create subtask under ${parentKey}`,
          content: key ?? "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    case BuiltInToolNames.JiraSetDependency: {
      const inward = getStringArg(args, "inwardIssueKey");
      const outward = getStringArg(args, "outwardIssueKey");
      const linkType = getStringArg(args, "linkType");
      const success = await jira_setJiraDependency(
        inward,
        outward,
        linkType,
        extras.config,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Link ${inward} -> ${outward}`,
          content: success ? "Linked" : "Failed",
          icon: extras.tool.faviconUrl,
        },
      ];
    }
    default:
      throw new Error(`Unknown Jira create tool: ${functionName}`);
  }
}
