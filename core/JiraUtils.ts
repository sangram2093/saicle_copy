import { HttpProxyAgent } from "http-proxy-agent";
import * as https from "https";
import fetch from "node-fetch";
import * as path from "path";
import { fileURLToPath } from "url";
import { ToolExtras } from ".";

//helper functions

const isProxied = (hostname: string, noProxyEnv: string): boolean => {
  if (!noProxyEnv) {
    return true;
  }
  if (noProxyEnv === "*") {
    return false;
  }
  const noProxyList = noProxyEnv.split(",").map((d) => d.trim().toLowerCase());
  for (const noProxyDomain of noProxyList) {
    const domain = noProxyDomain.startsWith(".")
      ? noProxyDomain.substring(1)
      : noProxyDomain;
    if (hostname.toLowerCase().endsWith(domain)) {
      return false;
    }
  }
  return true;
};

const formatTimeElapsed = (startDate: Date): string => {
  const elapsedMs = new Date().getTime() - startDate.getTime();
  const minutes = (elapsedMs / 1000 / 60).toFixed(2);
  const hours = Math.floor(Number(minutes) / 60);
  const remainingMinutes = (Number(minutes) % 60).toFixed(2);
  if (hours > 0) {
    return `${startDate.toISOString()} (elapsed: ${hours}h ${remainingMinutes}m)`;
  }
  return `${startDate.toISOString()} (elapsed: ${minutes}m)`;
};

class JiraClient {
  private readonly domain: string;
  private readonly apiToken: string;
  private readonly agent: https.Agent | HttpProxyAgent<string>;

  constructor(domain: string, apiToken: string) {
    this.domain = domain;
    this.apiToken = apiToken;

    const proxy =
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy;
    const noproxy = process.env.NO_PROXY || process.env.no_proxy || "";
    const jiraHostname = this.domain.split("/")[0];

    const agentOptions = {
      rejectUnauthorized: false,
      keepAlive: true,
    };

    if (proxy && isProxied(jiraHostname, noproxy)) {
      this.agent = new HttpProxyAgent(proxy, agentOptions);
    } else {
      this.agent = new https.Agent(agentOptions);
    }
  }

  private async fetch(
    path: string,
    method: "GET" | "POST" | "PUT",
    body: any = null,
    extraHeaders: any = {},
  ): Promise<any> {
    const url = `https://${this.domain}${path}`;
    const response = await this.fetchUrl(url, method, body, extraHeaders);
    return this.handleResponse(response, path);
  }

  private async fetchUrl(
    url: string,
    method: "GET" | "POST" | "PUT",
    body: any = null,
    extraHeaders: any = {},
  ): Promise<any> {
    const headers: any = {
      Authorization: `Bearer ${this.apiToken}`,
      ...extraHeaders,
    };

    const isFormData = body?.constructor?.name.startsWith("FormData");

    if (body && !isFormData) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    } else if (isFormData) {
      Object.assign(headers, body.getHeaders());
      headers["X-Atlassian-Token"] = "no-check";
    }

    const options: any = {
      method,
      headers,
      agent: this.agent,
      body: body,
    };

    if (!isFormData) {
      headers["accept"] = "application/json";
    }

    return await fetch(url, options);
  }

  private async handleResponse(response: any, path: string): Promise<any> {
    if (!response.ok) {
      console.error(
        `Error calling Jira API (${path}): ${response.status} ${response.statusText}`,
      );
      const errorText = await response.text();
      console.error(`Response: ${errorText}`);
      return null;
    }

    if (
      response.status === 204 ||
      response.headers.get("content-length") === "0"
    ) {
      return { sucess: true };
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch (error) {
        console.error(`Error parsing JSON response from ${path}: ${error}`);
        return null;
      }
    }
    return response.buffer();
  }

  async getJiraDescriptionText(issueKey: string): Promise<string | null> {
    const issueData = (await this.fetch(
      `/rest/api/2/issue/${issueKey}`,
      "GET",
    )) as { fields: { description: string } };
    if (!issueData || !issueData.fields || !issueData.fields.description) {
      return null;
    }
    return issueData.fields.description;
  }

  async setJiraDescriptionText(
    issueKey: string,
    description: string,
  ): Promise<boolean> {
    const url = `/rest/api/2/issue/${issueKey}`;
    const bodyData = {
      fields: {
        description: description,
      },
    };
    const result = await this.fetch(url, "PUT", bodyData);
    if (result) {
      console.log(`Successfully updated description for issue ${issueKey}`);
      return true;
    } else {
      console.error(`Failed to update description for issue ${issueKey}`);
    }
    return false;
  }

  async getJiraLabels(issueKey: string): Promise<string[] | null> {
    const issueData = (await this.fetch(
      `/rest/api/2/issue/${issueKey}?fields=labels`,
      "GET",
    )) as { fields: { labels: string[] } };
    if (!issueData || !issueData.fields || !issueData.fields.labels) {
      return null;
    }
    return issueData.fields.labels;
  }

  async setJiraLabels(issueKey: string, labels: string[]): Promise<boolean> {
    const url = `/rest/api/2/issue/${issueKey}`;
    const bodyData = {
      fields: {
        labels: labels,
      },
    };
    const result = await this.fetch(url, "PUT", bodyData);
    if (result) {
      console.log(`Successfully updated labels for issue ${issueKey}`);
      return true;
    } else {
      console.error(`Failed to update labels for issue ${issueKey}`);
    }
    return false;
  }

  async setJiraActivityType(
    issueKey: string,
    activityTypeName: string,
  ): Promise<boolean> {
    // First, get the issue's edit metadata to find the custom field ID for "Activity Type"
    const issueEditMeta = (await this.fetch(
      `/rest/api/2/issue/${issueKey}/editmeta`,
      "GET",
    )) as { fields: any };

    if (!issueEditMeta || !issueEditMeta.fields) {
      console.error(`Failed to retrieve edit metadata for issue ${issueKey}`);
      return false;
    }

    // Assuming "Activity Type" is a custom field, find its ID
    let activityTypeFieldId: string | null = null;
    let activityTypeField: any = null;
    for (const fieldId in issueEditMeta.fields) {
      if (issueEditMeta.fields[fieldId].name === "Activity Type") {
        activityTypeFieldId = fieldId;
        activityTypeField = issueEditMeta.fields[fieldId];
        break;
      }
    }

    if (!activityTypeFieldId || !activityTypeField) {
      console.error(`Activity Type field not found for issue ${issueKey}`);
      return false;
    }

    if (!activityTypeField.allowedValues) {
      console.error(
        `Activity Type field has no allowed values for issue ${issueKey}`,
      );
      return false;
    }

    const targetValue = activityTypeField.allowedValues.find(
      (v: { value: string }) =>
        v.value.toLowerCase() === activityTypeName.toLowerCase(),
    );

    if (!targetValue) {
      const availableValues = activityTypeField.allowedValues
        .map((v: { value: string }) => v.value)
        .join(", ");
      console.error(
        `Activity Type value "${activityTypeName}" not found for issue ${issueKey}. Available values: ${availableValues}`,
      );
      return false;
    }

    const bodyData = {
      fields: {
        [activityTypeFieldId]: { id: targetValue.id },
      },
    };

    const url = `/rest/api/2/issue/${issueKey}`;
    const result = await this.fetch(url, "PUT", bodyData);
    if (result) {
      console.log(`Successfully updated activity type for issue ${issueKey}`);
      return true;
    } else {
      console.error(`Failed to update activity type for issue ${issueKey}`);
    }
    return false;
  }

  async getJiraStatus(issueKey: string): Promise<string | null> {
    const issueData = (await this.fetch(
      `/rest/api/2/issue/${issueKey}`,
      "GET",
    )) as { fields: { status: { name: string } } };
    if (
      !issueData ||
      !issueData.fields ||
      !issueData.fields.status ||
      !issueData.fields.status.name
    ) {
      return null;
    }
    return issueData.fields.status.name;
  }

  async getJiraAssignee(issueKey: string): Promise<string | null> {
    const issueData = (await this.fetch(
      `/rest/api/2/issue/${issueKey}`,
      "GET",
    )) as { fields: { assignee: { displayName: string } } };
    if (
      !issueData ||
      !issueData.fields ||
      !issueData.fields.assignee ||
      !issueData.fields.assignee.displayName
    ) {
      return null;
    }
    return issueData.fields.assignee.displayName;
  }

  async createEpic(
    projectKey: string,
    summary: string,
    description: string,
    epicName: string,
  ): Promise<string | null> {
    return this.createJiraIssue(projectKey, "Epic", summary, description, {
      epicName,
    });
  }

  async createFeature(
    projectKey: string,
    summary: string,
    description: string,
    epicLink: string,
  ): Promise<string | null> {
    return this.createJiraIssue(
      projectKey,
      "New Feature",
      summary,
      description,
      { epicLink },
    );
  }

  async createStory(
    projectKey: string,
    summary: string,
    description: string,
  ): Promise<string | null> {
    return this.createJiraIssue(projectKey, "Story", summary, description);
  }

  async createSubtask(
    projectKey: string,
    parentKey: string,
    summary: string,
    description: string,
    activityType?: string,
  ): Promise<string | null> {
    const subtaskTypeId = await this.getSubtaskTypeId(projectKey);
    if (!subtaskTypeId) {
      console.error("Sub-task issue type not found in Jira for this project");
      return null;
    }
    return this.createJiraIssue(projectKey, "Sub-task", summary, description, {
      parentKey,
      activityType,
      issueTypeId: subtaskTypeId,
    });
  }

  async searchJiraIssuesWithJql(
    jql: string,
  ): Promise<{ key: string; title: string }[] | null> {
    if (!jql || jql.trim().length === 0) {
      return null;
    }

    const path = `/rest/api/2/search?jql=${encodeURIComponent(jql)}`;
    const searchData = (await this.fetch(path, "GET")) as {
      issues: { key: string; fields: { summary: string } }[];
    };

    if (!searchData || !searchData.issues) {
      return null;
    }
    return searchData.issues.map((issue) => ({
      key: issue.key,
      title: issue.fields.summary,
    }));
  }

  async searchJiraIssues(
    searchText: string,
  ): Promise<{ key: string; title: string }[] | null> {
    if (!searchText || searchText.trim().length === 0) {
      return null;
    }

    if (searchText.trim().length < 3) {
      return [];
    }

    const jql =
      searchText.startsWith("text ~") || searchText.includes("text ~")
        ? searchText
        : `text ~ "${searchText}" ORDER BY created DESC`;
    return this.searchJiraIssuesWithJql(jql);
  }

  async transitionJiraIssue(
    issueKey: string,
    transitionName: string,
  ): Promise<boolean> {
    const transitionUrl = `/rest/api/2/issue/${issueKey}/transitions`;
    const transitionsData = (await this.fetch(transitionUrl, "GET")) as {
      transitions: { id: string; name: string }[];
    };

    if (!transitionsData || !transitionsData.transitions) {
      console.error(`No transitions found for issue ${issueKey}`);
      return false;
    }
    const { transitions } = transitionsData;
    const transition = transitions.find(
      (t) => t.name.toLowerCase() === transitionName.toLowerCase(),
    );

    if (!transition) {
      console.error(
        `Transition "${transitionName}" not found for issue ${issueKey}`,
      );
      return false;
    }

    const transitionBody = {
      transition: {
        id: transition.id,
      },
    };
    const result = await this.fetch(transitionUrl, "POST", transitionBody);
    if (result) {
      console.log(
        `Successfully transitioned issue ${issueKey} to ${transitionName}`,
      );
      await this.addWorklog(
        issueKey,
        "1m",
        `Issue transitioned to ${transitionName}`,
      );
      return true;
    } else {
      console.error(
        `Failed to transition issue ${issueKey} to ${transitionName}`,
      );
    }
    return false;
  }

  async addWorklog(
    issueKey: string,
    timeSpent: string,
    comment: string,
  ): Promise<boolean> {
    const url = `/rest/api/2/issue/${issueKey}/worklog`;
    const bodyData = {
      timeSpent: timeSpent,
      comment: comment,
    };

    const result = await this.fetch(url, "POST", bodyData);
    if (result) {
      console.log(
        `Successfully added worklog to issue ${issueKey}: ${timeSpent} - ${comment}`,
      );
      return true;
    } else {
      console.error(`Failed to add worklog to issue ${issueKey}`);
    }
    return false;
  }

  async addComment(issueKey: string, comment: string): Promise<boolean> {
    const url = `/rest/api/2/issue/${issueKey}/comment`;
    const bodyData = {
      body: comment,
    };

    const result = await this.fetch(url, "POST", bodyData);
    if (result) {
      console.log(
        `Successfully added comment to issue ${issueKey}: ${comment}`,
      );
      return true;
    } else {
      console.error(`Failed to add comment to issue ${issueKey}`);
    }
    return false;
  }

  async assignUser(issueKey: string, username: string): Promise<boolean> {
    const url = `/rest/api/2/issue/${issueKey}/assignee`;
    const bodyData = {
      name: username,
    };

    const result = await this.fetch(url, "PUT", bodyData);
    if (result) {
      console.log(
        `Successfully assigned issue ${issueKey} to user ${username}`,
      );
      return true;
    } else {
      console.error(`Failed to assign issue ${issueKey} to user ${username}`);
    }
    return false;
  }

  async getLastWorklog(issueKey: string): Promise<any | null> {
    const url = `/rest/api/2/issue/${issueKey}/worklog`;
    const worklogData = (await this.fetch(url, "GET")) as {
      worklogs: {
        author: { displayName: string };
        timeSpent: string;
        comment: string;
        created: string;
      }[];
    };

    if (
      !worklogData ||
      !worklogData.worklogs ||
      worklogData.worklogs.length === 0
    ) {
      return null;
    }

    const lastWorklog = worklogData.worklogs[worklogData.worklogs.length - 1];
    return lastWorklog || null;
  }

  async getIssue(issueKey: string): Promise<any | null> {
    const issueData = await this.fetch(`/rest/api/2/issue/${issueKey}`, "GET");
    if (!issueData) {
      return null;
    }
    return issueData;
  }

  private async createJiraIssue(
    projectKey: string,
    issueTypeName: string,
    summary: string,
    description: string,
    options: {
      epicLink?: string;
      parentKey?: string;
      activityType?: string;
      epicName?: string;
      issueTypeId?: string;
    } = {},
  ): Promise<string | null> {
    const { epicLink, parentKey, activityType, epicName, issueTypeId } =
      options;

    const fields: any = {
      project: {
        key: projectKey,
      },
      summary,
      description,
      issuetype: {},
    };
    if (issueTypeId) {
      fields.issuetype.id = issueTypeId;
    } else {
      fields.issuetype.name = issueTypeName;
    }
    if (parentKey) {
      fields.parent = { key: parentKey };
    }
    if (epicLink) {
      const epicLinkFieldId = await this.getCustomFieldId("Epic Link");
      if (epicLinkFieldId) {
        fields[epicLinkFieldId] = epicLink;
      }
    }

    if (issueTypeName.toLowerCase() === "epic" && epicName) {
      const epicNameFieldId = await this.getCustomFieldId("Epic Name");
      if (epicNameFieldId) {
        fields[epicNameFieldId] = epicName;
      }
    }
    const result = await this.fetch("/rest/api/2/issue", "POST", { fields });
    if (result && result.key) {
      console.log(
        `Successfully created issue ${result.key} (${issueTypeName})`,
      );
      if (activityType) {
        await this.setJiraActivityType(result.key, activityType);
      }
      return result?.key || null;
    }
    console.error(`Failed to create issue (${issueTypeName})`);
    return null;
  }

  async getSubtaskTypeId(projectKey: string): Promise<string | null> {
    const createMetaData = await this.fetch(
      `/rest/api/2/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes.fields`,
      "GET",
    );
    if (
      createMetaData &&
      createMetaData.projects &&
      createMetaData.projects.length > 0
    ) {
      const project = createMetaData.projects[0];
      const subtaskType = project.issuetypes.find(
        (it: any) => it.subtask === true,
      );
      if (subtaskType) {
        return subtaskType.id;
      }
    }
    console.error(`No sub-task issue type found for project ${projectKey}`);
    return null;
  }

  async setJiraDependency(
    inwardIssueKey: string,
    outwardIssueKey: string,
    linkType: string,
  ): Promise<boolean> {
    const url = `/rest/api/2/issueLink`;
    const bodyData = {
      type: {
        name: linkType,
      },
      inwardIssue: {
        key: inwardIssueKey,
      },
      outwardIssue: {
        key: outwardIssueKey,
      },
    };

    const result = await this.fetch(url, "POST", bodyData);
    if (result) {
      console.log(
        `Successfully linked issue ${inwardIssueKey} to ${outwardIssueKey} with link type ${linkType}`,
      );
      return true;
    } else {
      console.error(
        `Failed to link issue ${inwardIssueKey} to ${outwardIssueKey} with link type ${linkType}`,
      );
    }
    return false;
  }

  async getIssueAttachments(issueKey: string): Promise<any[]> {
    const issueData = await this.fetch(
      `/rest/api/2/issue/${issueKey}?fields=attachment`,
      "GET",
    );
    if (!issueData) {
      return [];
    }
    return issueData.fields?.attachment || [];
  }

  async findSubtasksByActivityType(
    parentIssueKey: string,
    activityType: string,
  ): Promise<{ key: string; title: string }[] | null> {
    const jql = `parent=\"${parentIssueKey}\" AND \"Activity Type\" = \"${activityType}\" ORDER BY created DESC`;
    const searchResult = await this.searchJiraIssuesWithJql(jql);
    return searchResult || [];
  }

  async getJiraRequirement(issueKey: string): Promise<any[] | null> {
    const issueData = (await this.fetch(
      `/rest/api/2/issue/${issueKey}`,
      "GET",
    )) as { fields: { description: string } };
    if (!issueData || !issueData.fields || !issueData.fields.description) {
      return null;
    }
    const acceptanceCriteria = await this.getAcceptanceCriteria(issueKey);
    const parts = [
      {
        text: `Jira Issue Description:
        **Description:** 
      ${issueData.fields.description}

        **Acceptance Criteria:**
      ${acceptanceCriteria ? acceptanceCriteria : "No acceptance criteria defined."}
      
      `,
      } as any,
    ];
    const attachments = await this.getIssueAttachments(issueKey);
    for (const attachment of attachments) {
      const buffer = await this.getAttachmentContentAsBuffer(attachment);
      if (buffer) {
        const attachmentPart: any = {
          filename: attachment.filename,
          mimeType: attachment.mimeType,
        };

        if (
          attachment.mimeType &&
          !attachmentPart.mimeType.startsWith("text/")
        ) {
          attachmentPart.data = buffer.toString("base64");
        } else {
          attachmentPart.text = buffer.toString("utf-8");
        }
        parts.push(attachmentPart);
      }
    }

    return parts;
  }

  async getCustomFieldId(fieldName: string): Promise<string | null> {
    const fieldsData = (await this.fetch(`/rest/api/2/field`, "GET")) as {
      id: string;
      name: string;
    }[];

    if (!fieldsData || fieldsData.length === 0) {
      console.error("No fields data retrieved from Jira");
      return null;
    }

    const field = fieldsData.find(
      (f) => f.name.toLowerCase() === fieldName.toLowerCase(),
    );

    if (!field) {
      console.error(`Custom field "${fieldName}" not found in Jira`);
      return null;
    }

    return field.id;
  }

  async getAttachmentContentAsBuffer(attachment: any): Promise<Buffer | null> {
    if (!attachment || !attachment.content) {
      console.error("Invalid attachment object");
      return null;
    }

    const response = await this.fetchUrl(attachment.content, "GET");
    if (response && response.ok) {
      const buffer = await response.buffer();
      return buffer;
    } else {
      console.error(
        `Failed to fetch attachment content from ${attachment.content}`,
      );
      return null;
    }
  }
  async addAttachment(issueKey: string, filepath: string): Promise<boolean> {
    const url = `/rest/api/2/issue/${issueKey}/attachments`;
    const { default: formData } = await import("form-data");
    const { createReadStream, statSync } = await import("fs");
    const { basename } = await import("path");
    if (filepath.startsWith("file:/")) {
      const myUrl = new URL(filepath);
      filepath = fileURLToPath(myUrl);
    }
    const form = new formData();
    const stats = statSync(filepath);
    const stream = createReadStream(filepath);

    form.append("file", stream, {
      knownLength: stats.size,
      filename: basename(filepath),
    });

    const result = await this.fetch(url, "POST", form);
    if (result) {
      console.log(
        `Successfully added attachment to issue ${issueKey}: ${basename(filepath)}`,
      );
      return true;
    } else {
      console.error(`Failed to add attachment to issue ${issueKey}`);
    }
    return false;
  }

  async getDueDate(issueKey: string): Promise<string | null> {
    const issueData = (await this.fetch(
      `/rest/api/2/issue/${issueKey}?fields=duedate`,
      "GET",
    )) as { fields: { duedate: string } };
    return issueData.fields.duedate || null;
  }

  async setDueDate(issueKey: string, dueDate: string): Promise<boolean> {
    const url = `/rest/api/2/issue/${issueKey}`;
    const bodyData = {
      fields: {
        duedate: dueDate,
      },
    };
    const result = await this.fetch(url, "PUT", bodyData);
    if (result) {
      console.log(`Successfully updated due date for issue ${issueKey}`);
      return true;
    } else {
      console.error(`Failed to update due date for issue ${issueKey}`);
    }
    return false;
  }
  async getPlannedStartDate(issueKey: string): Promise<string | null> {
    const customFieldId = await this.getCustomFieldId("Planned Start");
    if (!customFieldId) {
      return null;
    }
    const issueData = await this.fetch(
      `/rest/api/2/issue/${issueKey}?fields=${customFieldId}`,
      "GET",
    );
    return issueData?.fields?.[customFieldId] || null;
  }

  async setPlannedStartDate(
    issueKey: string,
    startDate: string,
  ): Promise<boolean> {
    const customFieldId = await this.getCustomFieldId("Planned Start");
    if (!customFieldId) {
      return false;
    }
    const url = `/rest/api/2/issue/${issueKey}`;
    const converted = isoToJiraDateTime(startDate);
    if (!converted) {
      console.error(`Invalid start date format: ${startDate}`);
      return false;
    }
    const bodyData = {
      fields: {
        [customFieldId]: converted,
      },
    };
    const result = await this.fetch(url, "PUT", bodyData);
    if (result) {
      console.log(
        `Successfully updated planned start date for issue ${issueKey}`,
      );
      return true;
    } else {
      console.error(
        `Failed to update planned start date for issue ${issueKey}`,
      );
    }
    return false;
  }
  async getPlannedEndDate(issueKey: string): Promise<string | null> {
    const customFieldId = await this.getCustomFieldId("Planned End");
    if (!customFieldId) {
      return null;
    }
    const issueData = await this.fetch(
      `/rest/api/2/issue/${issueKey}?fields=${customFieldId}`,
      "GET",
    );
    return issueData?.fields?.[customFieldId] || null;
  }

  async setPlannedEndDate(issueKey: string, endDate: string): Promise<boolean> {
    const customFieldId = await this.getCustomFieldId("Planned End");
    if (!customFieldId) {
      return false;
    }
    const url = `/rest/api/2/issue/${issueKey}`;
    const converted = isoToJiraDateTime(endDate);
    if (!converted) {
      console.error(`Invalid end date format: ${endDate}`);
      return false;
    }
    const bodyData = {
      fields: {
        [customFieldId]: converted,
      },
    };
    const result = await this.fetch(url, "PUT", bodyData);
    if (result) {
      console.log(
        `Successfully updated planned end date for issue ${issueKey}`,
      );
      return true;
    } else {
      console.error(`Failed to update planned end date for issue ${issueKey}`);
    }
    return false;
  }

  async getAcceptanceCriteria(issueKey: string): Promise<string | null> {
    const customFieldId = await this.getCustomFieldId("Acceptance criteria");
    if (!customFieldId) {
      return null;
    }
    const issueData = await this.fetch(
      `/rest/api/2/issue/${issueKey}?fields=${customFieldId}`,
      "GET",
    );
    return issueData?.fields?.[customFieldId] || null;
  }
  async setAcceptanceCriteria(
    issueKey: string,
    criteria: string,
  ): Promise<boolean> {
    const customFieldId = await this.getCustomFieldId("Acceptance criteria");
    if (!customFieldId) {
      return false;
    }
    const url = `/rest/api/2/issue/${issueKey}`;
    const bodyData = {
      fields: {
        [customFieldId]: criteria,
      },
    };
    const result = await this.fetch(url, "PUT", bodyData);
    if (result) {
      console.log(
        `Successfully updated acceptance criteria for issue ${issueKey}`,
      );
      return true;
    } else {
      console.error(
        `Failed to update acceptance criteria for issue ${issueKey}`,
      );
    }
    return false;
  }
  async getFixVersionsForJiraIssue(issueKey: string): Promise<string | null> {
    const issueData = await this.fetch(
      `/rest/api/2/issue/${issueKey}?fields=fixVersions`,
      "GET",
    );
    return issueData?.fields?.fixVersions || null;
  }

  async getProjectVersions(projectKey: string): Promise<any[] | null> {
    try {
      const versions = await this.fetch(
        `/rest/api/2/project/${encodeURIComponent(projectKey)}/versions`,
        "GET",
      );
      return Array.isArray(versions) ? versions : null;
    } catch (error) {
      console.error(
        `Failed to fetch project versions for ${projectKey}:`,
        error,
      );
      return null;
    }
  }

  async setFixVersionsForJiraIssue(
    issueKey: string,
    versionNames: string[],
  ): Promise<boolean> {
    const projectKey = issueKey.split("-")[0];
    const allowedVersions = await this.getProjectVersions(projectKey);
    if (!allowedVersions) {
      console.error(`No allowed fix versions found for project ${projectKey}`);
      return false;
    }
    const validVersions = allowedVersions.filter((v) =>
      versionNames.includes(v.name),
    );

    if (validVersions.length === 0) {
      console.error(
        `None of fix versions specified for issue ${issueKey}: are valid , valid versions are ${validVersions.join(", ")}`,
      );
      return false;
    }
    const url = `/rest/api/2/issue/${issueKey}`;
    const bodyData = {
      fields: {
        fixVersions: validVersions,
      },
    };
    const result = await this.fetch(url, "PUT", bodyData);
    if (result) {
      console.log(`Successfully updated fix versions for issue ${issueKey}`);
      return true;
    } else {
      console.error(`Failed to update fix versions for issue ${issueKey}`);
    }
    return false;
  }

  async markActivityCompleted(
    issueKey: string,
    activityName: string,
  ): Promise<boolean> {
    try {
      // Fetch issue to get comments
      const issueData = await this.getIssue(issueKey);
      if (!issueData || !issueData.fields || !issueData.fields.comment) {
        console.error(`Failed to retrieve comments for issue ${issueKey}`);
        return false;
      }

      // Get comments and sort by creation time in descending order
      const comments = issueData.fields.comment.comments || [];
      const sortedComments = comments.sort(
        (a: any, b: any) =>
          new Date(b.created).getTime() - new Date(a.created).getTime(),
      );

      // Search for the start marker comment
      const startMarkerPattern = new RegExp(
        `Added by dbSaicle\\. Start of '${activityName}' : ts : (.+)`,
      );
      let activityStartTime: string | null = null;

      for (const comment of sortedComments) {
        const match = comment.body.match(startMarkerPattern);
        if (match) {
          activityStartTime = match[1];
          break;
        }
      }

      if (!activityStartTime) {
        console.error(
          `No activity start marker found for activity '${activityName}' in issue ${issueKey}`,
        );
        return false;
      }

      // Calculate time interval
      const startDate = new Date(activityStartTime);
      const endDate = new Date();

      if (isNaN(startDate.getTime())) {
        console.error(
          `Invalid activity start timestamp format: ${activityStartTime}`,
        );
        return false;
      }

      // Calculate time difference in milliseconds
      const diffMs = endDate.getTime() - startDate.getTime();

      // Convert to time units
      const totalSeconds = Math.floor(diffMs / 1000);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const totalHours = Math.floor(totalMinutes / 60);
      const totalDays = Math.floor(totalHours / 24);
      const weeks = Math.floor(totalDays / 7);

      const remainingDays = totalDays % 7;
      const remainingHours = totalHours % 24;
      const remainingMinutes = totalMinutes % 60;

      // Format as '<weeks>w <days>d <hrs>h <minutes>m'
      const timeSpentString = `${weeks}w ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;

      // Add worklog entry
      const worklogSuccess = await this.addWorklog(
        issueKey,
        timeSpentString,
        `Activity ${activityName} completed`,
      );

      if (!worklogSuccess) {
        console.error(
          `Failed to add worklog for activity '${activityName}' in issue ${issueKey}`,
        );
        return false;
      }

      // Add end marker comment
      const endMarkerComment = `Added by dbSaicle. End of '${activityName}' : ts : ${endDate.toISOString()}`;
      const commentSuccess = await this.addComment(issueKey, endMarkerComment);

      if (!commentSuccess) {
        console.error(
          `Failed to add end marker comment for activity '${activityName}' in issue ${issueKey}`,
        );
        return false;
      }

      console.log(
        `Successfully marked activity '${activityName}' as completed in issue ${issueKey}. Time spent: ${timeSpentString}`,
      );
      return true;
    } catch (error) {
      console.error(
        `Error marking activity '${activityName}' as completed in issue ${issueKey}: ${error}`,
      );
      return false;
    }
  }

  async markStartOfActivity(
    issueKey: string,
    activityName: string,
  ): Promise<boolean> {
    try {
      // Get current timestamp in ISO format
      const currentTimestamp = new Date().toISOString();

      // Create the start marker comment
      const startMarkerComment = `Added by dbSaicle. Start of '${activityName}' : ts : ${currentTimestamp}`;

      // Add the comment to the issue
      const commentSuccess = await this.addComment(
        issueKey,
        startMarkerComment,
      );

      if (!commentSuccess) {
        console.error(
          `Failed to add start marker comment for activity '${activityName}' in issue ${issueKey}`,
        );
        return false;
      }

      console.log(
        `Successfully marked start of activity '${activityName}' in issue ${issueKey}`,
      );
      return true;
    } catch (error) {
      console.error(
        `Error marking start of activity '${activityName}' in issue ${issueKey}: ${error}`,
      );
      return false;
    }
  }
}

// Helper to resolve jira config from runtime config or environment
function resolveJiraConfigFromOptionalSource(config?: any) {
  const domain =
    config?.jira?.domain ||
    process.env.JIRA_DOMAIN ||
    process.env.JIRA_HOST ||
    undefined;
  const apiToken =
    config?.jira?.apiToken ||
    process.env.JIRA_API_TOKEN ||
    process.env.JIRA_TOKEN ||
    undefined;
  const authEmail =
    config?.jira?.authEmail ||
    process.env.JIRA_AUTH_EMAIL ||
    process.env.JIRA_EMAIL ||
    undefined;
  return { domain, apiToken, authEmail };
}

// Tool wrappers â€” exported functions prefixed with jira_
export async function jira_getJiraStatus(issueKey: string, config?: any) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getJiraStatus(issueKey);
}

export async function jira_getJiraAssignee(issueKey: string, config?: any) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getJiraAssignee(issueKey);
}

export async function jira_searchJiraIssues(searchText: string, config?: any) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.searchJiraIssues(searchText);
}

export async function jira_transitionJiraIssue(
  issueKey: string,
  transitionName: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.transitionJiraIssue(issueKey, transitionName);
}

export async function jira_addWorklog(
  issueKey: string,
  timeSpent: string,
  comment: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.addWorklog(issueKey, timeSpent, comment);
}

export async function jira_addComment(
  issueKey: string,
  comment: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.addComment(issueKey, comment);
}

export async function jira_assignUser(
  issueKey: string,
  username: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.assignUser(issueKey, username);
}

export async function jira_getLastWorklog(issueKey: string, config?: any) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getLastWorklog(issueKey);
}

export async function jira_getJiraRequirement(issueKey: string, config?: any) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getJiraRequirement(issueKey);
}

// Additional tool wrappers
export async function jira_getJiraDescriptionText(
  issueKey: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getJiraDescriptionText(issueKey);
}

export async function jira_setJiraDescriptionText(
  issueKey: string,
  description: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.setJiraDescriptionText(issueKey, description);
}

export async function jira_getJiraLabels(issueKey: string, config?: any) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getJiraLabels(issueKey);
}

export async function jira_setJiraLabels(
  issueKey: string,
  labels: string[],
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.setJiraLabels(issueKey, labels);
}

export async function jira_setJiraActivityType(
  issueKey: string,
  activityTypeName: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.setJiraActivityType(issueKey, activityTypeName);
}

export async function jira_createEpic(
  projectKey: string,
  summary: string,
  description: string,
  epicName: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.createEpic(projectKey, summary, description, epicName);
}

export async function jira_createFeature(
  projectKey: string,
  summary: string,
  description: string,
  epicLink: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.createFeature(projectKey, summary, description, epicLink);
}

export async function jira_createStory(
  projectKey: string,
  summary: string,
  description: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.createStory(projectKey, summary, description);
}

export async function jira_createSubtask(
  projectKey: string,
  parentKey: string,
  summary: string,
  description: string,
  activityType: string | undefined,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.createSubtask(
    projectKey,
    parentKey,
    summary,
    description,
    activityType,
  );
}

export async function jira_searchJiraIssuesWithJql(jql: string, config?: any) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.searchJiraIssuesWithJql(jql);
}

export async function jira_setJiraDependency(
  inwardIssueKey: string,
  outwardIssueKey: string,
  linkType: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.setJiraDependency(
    inwardIssueKey,
    outwardIssueKey,
    linkType,
  );
}

export async function jira_getIssueAttachments(issueKey: string, config?: any) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getIssueAttachments(issueKey);
}

export async function jira_findSubtasksByActivityType(
  parentIssueKey: string,
  activityType: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.findSubtasksByActivityType(parentIssueKey, activityType);
}

export async function jira_addAttachment(
  issueKey: string,
  filepath: string,
  extras?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(
    extras.config,
  );
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  const workspaceDirs = await (extras as ToolExtras).ide.getWorkspaceDirs();
  if (workspaceDirs && workspaceDirs.length > 0) {
    filepath = path.join(workspaceDirs[0], filepath);
  }

  return await client.addAttachment(issueKey, filepath);
}

export async function jira_getDueDate(issueKey: string, config?: any) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getDueDate(issueKey);
}

export async function jira_setDueDate(
  issueKey: string,
  dueDate: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.setDueDate(issueKey, dueDate);
}

export async function jira_getPlannedStartDate(issueKey: string, config?: any) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getPlannedStartDate(issueKey);
}

export async function jira_setPlannedStartDate(
  issueKey: string,
  startDate: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.setPlannedStartDate(issueKey, startDate);
}

export async function jira_getPlannedEndDate(issueKey: string, config?: any) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getPlannedEndDate(issueKey);
}

export async function jira_setPlannedEndDate(
  issueKey: string,
  endDate: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.setPlannedEndDate(issueKey, endDate);
}

export async function jira_getAcceptanceCriteria(
  issueKey: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getAcceptanceCriteria(issueKey);
}

export async function jira_setAcceptanceCriteria(
  issueKey: string,
  criteria: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.setAcceptanceCriteria(issueKey, criteria);
}

export async function jira_getFixVersionsForJiraIssue(
  issueKey: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getFixVersionsForJiraIssue(issueKey);
}

export async function jira_getProjectVersions(
  projectKey: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.getProjectVersions(projectKey);
}

export async function jira_setFixVersionsForJiraIssue(
  issueKey: string,
  versionNames: string[],
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.setFixVersionsForJiraIssue(issueKey, versionNames);
}

export async function jira_markActivityCompleted(
  issueKey: string,
  activityName: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.markActivityCompleted(issueKey, activityName);
}

export async function jira_markStartOfActivity(
  issueKey: string,
  activityName: string,
  config?: any,
) {
  const { domain, apiToken } = resolveJiraConfigFromOptionalSource(config);
  if (!domain || !apiToken) {
    throw new Error(
      "Jira configuration missing: jira_domain and jira_api_token are required",
    );
  }
  const client = new JiraClient(domain, apiToken);
  return await client.markStartOfActivity(issueKey, activityName);
}

export function isoToJiraDateTime(isoDate: string | Date): string | null {
  const d = isoDate instanceof Date ? isoDate : new Date(isoDate);
  if (isNaN(d.getTime())) {
    return null;
  }

  const pad = (n: number, digits = 2) => n.toString().padStart(digits, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const ms = d.getMilliseconds().toString().padStart(3, "0");

  const tzMinutes = -d.getTimezoneOffset();
  const sign = tzMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(tzMinutes);
  const tzHours = Math.floor(absMinutes / 60);
  const tzMins = absMinutes % 60;
  const tz = `${sign}${pad(tzHours)}${pad(tzMins)}`;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${tz}`;
}
