import { ContextItem, ToolExtras } from "../..";
import { BuiltInToolNames } from "../builtIn";
import {
  getBooleanArg,
  getNumberArg,
  getOptionalStringArg,
  getStringArg,
} from "../parseArgs";

type ServiceNowAuthConfig = {
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

type ServiceNowConfig = {
  instanceUrl?: string;
  timeout?: number;
  auth?: ServiceNowAuthConfig;
};

type OAuthTokenCache = {
  token: string;
  tokenType: string;
  expiresAt?: number;
};

const oauthTokenCache = new Map<string, OAuthTokenCache>();

function normalizeInstanceUrl(url: string) {
  const trimmed = url.replace(/\/$/, "");
  if (trimmed.endsWith("/api/now")) {
    return trimmed.slice(0, -"/api/now".length);
  }
  return trimmed;
}

function getServiceNowConfig(config: any): ServiceNowConfig {
  const serviceNowConfig = config?.servicenow;
  if (!serviceNowConfig) {
    throw new Error("ServiceNow configuration not found in config");
  }
  if (!serviceNowConfig.instanceUrl) {
    throw new Error("ServiceNow instanceUrl is required");
  }
  if (!serviceNowConfig.auth?.type) {
    throw new Error("ServiceNow auth.type is required");
  }
  return serviceNowConfig;
}

function getOptionalNumberArg(
  args: any,
  key: string,
  defaultValue?: number,
) {
  if (typeof args?.[key] === "undefined") {
    return defaultValue;
  }
  return getNumberArg(args, key);
}

function getStringArrayArg(args: any, key: string): string[] {
  const value = args?.[key];
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.trim());
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  throw new Error(`Argument \`${key}\` must be an array of strings`);
}

function getOptionalStringArrayArg(args: any, key: string): string[] | undefined {
  if (!args || !(key in args)) {
    return undefined;
  }
  return getStringArrayArg(args, key);
}

function getFieldsArg(args: any, key: string): Record<string, any> {
  const value = args?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Argument \`${key}\` must be an object`);
  }
  return value as Record<string, any>;
}

async function serviceNowRequest(
  extras: ToolExtras,
  config: ServiceNowConfig,
  options: {
    method: string;
    path: string;
    query?: Record<string, string>;
    body?: any;
    retryOnUnauthorized?: boolean;
  },
): Promise<any> {
  const instanceUrl = normalizeInstanceUrl(config.instanceUrl || "");
  const baseUrl = `${instanceUrl}/api/now`;
  const url = new URL(`${baseUrl}${options.path}`);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (typeof value !== "undefined") {
        url.searchParams.set(key, value);
      }
    });
  }

  const headers = await getAuthHeaders(extras, config);
  const method = options.method.toUpperCase();
  const init: any = {
    method,
    headers,
  };
  if (typeof options.body !== "undefined") {
    init.body = JSON.stringify(options.body);
  }

  const timeoutMs = (config.timeout ?? 30) * 1000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  init.signal = controller.signal;

  try {
    const response = await extras.fetch(url.toString(), init);
    if (
      response.status === 401 &&
      config.auth?.type === "oauth" &&
      options.retryOnUnauthorized !== false
    ) {
      await getOAuthToken(extras, config, true);
      return serviceNowRequest(extras, config, {
        ...options,
        retryOnUnauthorized: false,
      });
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ServiceNow API error (${response.status}): ${errorText || response.statusText}`,
      );
    }
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

function isSysId(value: string) {
  return /^[0-9a-f]{32}$/i.test(value);
}

async function resolveRecordSysId(
  extras: ToolExtras,
  config: ServiceNowConfig,
  table: string,
  recordId: string,
  numberField = "number",
) {
  if (isSysId(recordId)) {
    return recordId;
  }
  const data = await serviceNowRequest(extras, config, {
    method: "GET",
    path: `/table/${table}`,
    query: {
      sysparm_query: `${numberField}=${recordId}`,
      sysparm_limit: "1",
    },
  });
  const result = data?.result || [];
  if (!result.length) {
    throw new Error(`${table} record not found: ${recordId}`);
  }
  return result[0].sys_id;
}

function getListQueryParams(args: any) {
  const limit = getOptionalNumberArg(args, "limit", 10) ?? 10;
  const offset = getOptionalNumberArg(args, "offset", 0) ?? 0;
  const query =
    getOptionalStringArg(args, "query") ||
    getOptionalStringArg(args, "sysparm_query");
  const displayValue =
    typeof args?.display_value !== "undefined"
      ? getBooleanArg(args, "display_value", false)
      : true;
  const excludeReferenceLink =
    typeof args?.exclude_reference_link !== "undefined"
      ? getBooleanArg(args, "exclude_reference_link", false)
      : true;
  const fields = getOptionalStringArrayArg(args, "fields");
  const queryParams: Record<string, string> = {
    sysparm_limit: String(limit),
    sysparm_offset: String(offset),
    sysparm_display_value: String(displayValue),
    sysparm_exclude_reference_link: String(excludeReferenceLink),
  };
  if (query) queryParams.sysparm_query = query;
  if (fields && fields.length) queryParams.sysparm_fields = fields.join(",");
  return { queryParams, limit, offset };
}

function getRecordQueryParams(args: any) {
  const displayValue =
    typeof args?.display_value !== "undefined"
      ? getBooleanArg(args, "display_value", false)
      : true;
  const excludeReferenceLink =
    typeof args?.exclude_reference_link !== "undefined"
      ? getBooleanArg(args, "exclude_reference_link", false)
      : true;
  const fields = getOptionalStringArrayArg(args, "fields");
  const queryParams: Record<string, string> = {
    sysparm_display_value: String(displayValue),
    sysparm_exclude_reference_link: String(excludeReferenceLink),
  };
  if (fields && fields.length) queryParams.sysparm_fields = fields.join(",");
  return queryParams;
}

async function getAuthHeaders(
  extras: ToolExtras,
  config: ServiceNowConfig,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const auth = config.auth;
  if (!auth?.type) {
    throw new Error("ServiceNow auth.type is required");
  }

  if (auth.type === "basic") {
    const username = auth.basic?.username;
    const password = auth.basic?.password;
    if (!username || !password) {
      throw new Error("ServiceNow basic auth requires username and password");
    }
    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    headers.Authorization = `Basic ${encoded}`;
    return headers;
  }

  if (auth.type === "api_key") {
    const apiKey = auth.apiKey?.apiKey;
    if (!apiKey) {
      throw new Error("ServiceNow api_key auth requires apiKey");
    }
    const headerName = auth.apiKey?.headerName || "X-ServiceNow-API-Key";
    headers[headerName] = apiKey;
    return headers;
  }

  if (auth.type === "oauth") {
    const token = await getOAuthToken(extras, config, false);
    headers.Authorization = `${token.tokenType} ${token.token}`;
    return headers;
  }

  throw new Error(`Unsupported ServiceNow auth type: ${auth.type}`);
}

async function getOAuthToken(
  extras: ToolExtras,
  config: ServiceNowConfig,
  forceRefresh: boolean,
): Promise<OAuthTokenCache> {
  const oauth = config.auth?.oauth;
  if (!oauth?.clientId || !oauth?.clientSecret) {
    throw new Error("ServiceNow OAuth requires clientId and clientSecret");
  }
  const cacheKey = `${config.instanceUrl}|${oauth.clientId}|${oauth.username || ""}`;
  const cached = oauthTokenCache.get(cacheKey);
  if (cached && !forceRefresh) {
    if (!cached.expiresAt || cached.expiresAt > Date.now()) {
      return cached;
    }
  }

  const tokenUrl =
    oauth.tokenUrl || deriveTokenUrl(config.instanceUrl || "");
  if (!tokenUrl) {
    throw new Error("ServiceNow OAuth tokenUrl could not be determined");
  }

  const authHeader = Buffer.from(
    `${oauth.clientId}:${oauth.clientSecret}`,
  ).toString("base64");

  const headers = {
    Authorization: `Basic ${authHeader}`,
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  const tryTokenRequest = async (body: URLSearchParams) => {
    const response = await extras.fetch(tokenUrl, {
      method: "POST",
      headers,
      body: body.toString(),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ServiceNow OAuth error (${response.status}): ${errorText || response.statusText}`,
      );
    }
    return response.json();
  };

  let tokenData: any;
  try {
    tokenData = await tryTokenRequest(
      new URLSearchParams({ grant_type: "client_credentials" }),
    );
  } catch (clientCredentialsError) {
    if (oauth.username && oauth.password) {
      tokenData = await tryTokenRequest(
        new URLSearchParams({
          grant_type: "password",
          username: oauth.username,
          password: oauth.password,
        }),
      );
    } else {
      throw clientCredentialsError;
    }
  }

  const token = tokenData?.access_token;
  const tokenType = tokenData?.token_type || "Bearer";
  if (!token) {
    throw new Error("ServiceNow OAuth token response missing access_token");
  }

  const expiresIn = Number(tokenData?.expires_in);
  const expiresAt =
    !isNaN(expiresIn) && expiresIn > 0
      ? Date.now() + (expiresIn - 60) * 1000
      : undefined;

  const cachedToken: OAuthTokenCache = {
    token,
    tokenType,
    expiresAt,
  };
  oauthTokenCache.set(cacheKey, cachedToken);
  return cachedToken;
}

function deriveTokenUrl(instanceUrl: string) {
  if (!instanceUrl) return undefined;
  try {
    const url = new URL(instanceUrl);
    const host = url.hostname;
    if (!host) return undefined;
    return `${url.protocol}//${host}/oauth_token.do`;
  } catch {
    return undefined;
  }
}

function toContextItem(
  extras: ToolExtras,
  description: string,
  data: any,
): ContextItem[] {
  return [
    {
      name: extras.tool.displayTitle,
      description,
      content: JSON.stringify(data, null, 2),
      icon: extras.tool.faviconUrl,
    },
  ];
}

async function resolveIncidentSysId(
  extras: ToolExtras,
  config: ServiceNowConfig,
  incidentId: string,
) {
  if (/^[0-9a-f]{32}$/i.test(incidentId)) {
    return incidentId;
  }
  const data = await serviceNowRequest(extras, config, {
    method: "GET",
    path: "/table/incident",
    query: {
      sysparm_query: `number=${incidentId}`,
      sysparm_limit: "1",
    },
  });
  const result = data?.result || [];
  if (!result.length) {
    throw new Error(`Incident not found: ${incidentId}`);
  }
  return result[0].sys_id;
}

function formatDateTime(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function getCatalogItemVariables(
  extras: ToolExtras,
  config: ServiceNowConfig,
  itemId: string,
) {
  const data = await serviceNowRequest(extras, config, {
    method: "GET",
    path: "/table/item_option_new",
    query: {
      sysparm_query: `cat_item=${itemId}^ORDERBYorder`,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    },
  });
  const variables = data?.result || [];
  return variables.map((variable: any) => ({
    sys_id: variable.sys_id || "",
    name: variable.name || "",
    label: variable.question_text || "",
    type: variable.type || "",
    mandatory: variable.mandatory || "",
    default_value: variable.default_value || "",
    help_text: variable.help_text || "",
    order: variable.order || "",
  }));
}

export async function handleServiceNowTools(
  functionName: BuiltInToolNames,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const config = getServiceNowConfig(extras.config);

  switch (functionName) {
    case BuiltInToolNames.ServiceNowCreateIncident: {
      const shortDescription = getStringArg(args, "short_description");
      const description = getOptionalStringArg(args, "description");
      const payload: any = { short_description: shortDescription };
      const optionalFields = [
        "caller_id",
        "category",
        "subcategory",
        "priority",
        "impact",
        "urgency",
        "assigned_to",
        "assignment_group",
      ];
      optionalFields.forEach((field) => {
        const value = getOptionalStringArg(args, field);
        if (value) payload[field] = value;
      });
      if (description) payload.description = description;

      const data = await serviceNowRequest(extras, config, {
        method: "POST",
        path: "/table/incident",
        body: payload,
      });

      return toContextItem(extras, "Incident created", {
        success: true,
        message: "Incident created successfully",
        incident_id: data?.result?.sys_id,
        incident_number: data?.result?.number,
      });
    }

    case BuiltInToolNames.ServiceNowUpdateIncident: {
      const incidentId = getStringArg(args, "incident_id");
      const sysId = await resolveIncidentSysId(extras, config, incidentId);
      const payload: any = {};
      const fields = [
        "short_description",
        "description",
        "state",
        "category",
        "subcategory",
        "priority",
        "impact",
        "urgency",
        "assigned_to",
        "assignment_group",
        "work_notes",
        "close_notes",
        "close_code",
      ];
      fields.forEach((field) => {
        const value = getOptionalStringArg(args, field);
        if (typeof value !== "undefined") payload[field] = value;
      });

      const data = await serviceNowRequest(extras, config, {
        method: "PUT",
        path: `/table/incident/${sysId}`,
        body: payload,
      });

      return toContextItem(extras, "Incident updated", {
        success: true,
        message: "Incident updated successfully",
        incident_id: data?.result?.sys_id,
        incident_number: data?.result?.number,
      });
    }

    case BuiltInToolNames.ServiceNowAddComment: {
      const incidentId = getStringArg(args, "incident_id");
      const comment = getStringArg(args, "comment");
      const isWorkNote = getBooleanArg(args, "is_work_note", false) ?? false;
      const sysId = await resolveIncidentSysId(extras, config, incidentId);
      const payload: any = {};
      if (isWorkNote) {
        payload.work_notes = comment;
      } else {
        payload.comments = comment;
      }
      const data = await serviceNowRequest(extras, config, {
        method: "PUT",
        path: `/table/incident/${sysId}`,
        body: payload,
      });
      return toContextItem(extras, "Comment added", {
        success: true,
        message: "Comment added successfully",
        incident_id: data?.result?.sys_id,
        incident_number: data?.result?.number,
      });
    }

    case BuiltInToolNames.ServiceNowResolveIncident: {
      const incidentId = getStringArg(args, "incident_id");
      const resolutionCode = getStringArg(args, "resolution_code");
      const resolutionNotes = getStringArg(args, "resolution_notes");
      const sysId = await resolveIncidentSysId(extras, config, incidentId);

      const payload = {
        state: "6",
        close_code: resolutionCode,
        close_notes: resolutionNotes,
        resolved_at: "now",
      };
      const data = await serviceNowRequest(extras, config, {
        method: "PUT",
        path: `/table/incident/${sysId}`,
        body: payload,
      });
      return toContextItem(extras, "Incident resolved", {
        success: true,
        message: "Incident resolved successfully",
        incident_id: data?.result?.sys_id,
        incident_number: data?.result?.number,
      });
    }

    case BuiltInToolNames.ServiceNowListIncidents: {
      const limit = getOptionalNumberArg(args, "limit", 10) ?? 10;
      const offset = getOptionalNumberArg(args, "offset", 0) ?? 0;
      const filters: string[] = [];
      const state = getOptionalStringArg(args, "state");
      const assignedTo = getOptionalStringArg(args, "assigned_to");
      const category = getOptionalStringArg(args, "category");
      const query = getOptionalStringArg(args, "query");

      if (state) filters.push(`state=${state}`);
      if (assignedTo) filters.push(`assigned_to=${assignedTo}`);
      if (category) filters.push(`category=${category}`);
      if (query) {
        filters.push(
          `short_descriptionLIKE${query}^ORdescriptionLIKE${query}`,
        );
      }

      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/incident",
        query: {
          sysparm_limit: String(limit),
          sysparm_offset: String(offset),
          sysparm_display_value: "true",
          sysparm_exclude_reference_link: "true",
          ...(filters.length ? { sysparm_query: filters.join("^") } : {}),
        },
      });

      const incidents = (data?.result || []).map((incident: any) => {
        let assignedToField = incident.assigned_to;
        if (assignedToField && typeof assignedToField === "object") {
          assignedToField = assignedToField.display_value;
        }
        return {
          sys_id: incident.sys_id,
          number: incident.number,
          short_description: incident.short_description,
          description: incident.description,
          state: incident.state,
          priority: incident.priority,
          assigned_to: assignedToField,
          category: incident.category,
          subcategory: incident.subcategory,
          created_on: incident.sys_created_on,
          updated_on: incident.sys_updated_on,
        };
      });

      return toContextItem(extras, "Incidents list", {
        success: true,
        message: `Found ${incidents.length} incidents`,
        incidents,
      });
    }

    case BuiltInToolNames.ServiceNowGetIncident: {
      const incidentId = getStringArg(args, "incident_id");
      const sysId = await resolveIncidentSysId(extras, config, incidentId);
      const query = getRecordQueryParams(args);
      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: `/table/incident/${sysId}`,
        query,
      });
      const incident = data?.result;
      if (!incident) {
        return toContextItem(extras, "Incident not found", {
          success: false,
          message: `Incident not found: ${incidentId}`,
        });
      }
      return toContextItem(extras, "Incident details", {
        success: true,
        incident,
      });
    }

    case BuiltInToolNames.ServiceNowListCatalogItems: {
      const limit = getOptionalNumberArg(args, "limit", 10) ?? 10;
      const offset = getOptionalNumberArg(args, "offset", 0) ?? 0;
      const category = getOptionalStringArg(args, "category");
      const query = getOptionalStringArg(args, "query");
      const active =
        typeof args?.active !== "undefined"
          ? getBooleanArg(args, "active", true)
          : true;

      const filters: string[] = [];
      if (typeof active !== "undefined") {
        filters.push(`active=${String(active).toLowerCase()}`);
      }
      if (category) filters.push(`category=${category}`);
      if (query) {
        filters.push(`short_descriptionLIKE${query}^ORnameLIKE${query}`);
      }

      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/sc_cat_item",
        query: {
          sysparm_limit: String(limit),
          sysparm_offset: String(offset),
          sysparm_display_value: "true",
          sysparm_exclude_reference_link: "true",
          ...(filters.length ? { sysparm_query: filters.join("^") } : {}),
        },
      });

      const items = (data?.result || []).map((item: any) => ({
        sys_id: item.sys_id || "",
        name: item.name || "",
        short_description: item.short_description || "",
        category: item.category || "",
        price: item.price || "",
        picture: item.picture || "",
        active: item.active || "",
        order: item.order || "",
      }));

      return toContextItem(extras, "Catalog items list", {
        success: true,
        message: `Retrieved ${items.length} catalog items`,
        items,
        total: items.length,
        limit,
        offset,
      });
    }

    case BuiltInToolNames.ServiceNowGetCatalogItem: {
      const itemId = getStringArg(args, "item_id");
      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: `/table/sc_cat_item/${itemId}`,
        query: {
          sysparm_display_value: "true",
          sysparm_exclude_reference_link: "true",
        },
      });
      const item = data?.result;
      if (!item) {
        return toContextItem(extras, "Catalog item not found", {
          success: false,
          message: `Catalog item not found: ${itemId}`,
        });
      }
      const variables = await getCatalogItemVariables(extras, config, itemId);
      const formatted = {
        sys_id: item.sys_id || "",
        name: item.name || "",
        short_description: item.short_description || "",
        description: item.description || "",
        category: item.category || "",
        price: item.price || "",
        picture: item.picture || "",
        active: item.active || "",
        order: item.order || "",
        delivery_time: item.delivery_time || "",
        availability: item.availability || "",
        variables,
      };
      return toContextItem(extras, "Catalog item details", {
        success: true,
        message: `Retrieved catalog item: ${item.name || itemId}`,
        data: formatted,
      });
    }

    case BuiltInToolNames.ServiceNowListCatalogCategories: {
      const limit = getOptionalNumberArg(args, "limit", 10) ?? 10;
      const offset = getOptionalNumberArg(args, "offset", 0) ?? 0;
      const query = getOptionalStringArg(args, "query");
      const active =
        typeof args?.active !== "undefined"
          ? getBooleanArg(args, "active", true)
          : true;

      const filters: string[] = [];
      if (typeof active !== "undefined") {
        filters.push(`active=${String(active).toLowerCase()}`);
      }
      if (query) {
        filters.push(`titleLIKE${query}^ORdescriptionLIKE${query}`);
      }

      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/sc_category",
        query: {
          sysparm_limit: String(limit),
          sysparm_offset: String(offset),
          sysparm_display_value: "true",
          sysparm_exclude_reference_link: "true",
          ...(filters.length ? { sysparm_query: filters.join("^") } : {}),
        },
      });

      const categories = (data?.result || []).map((categoryItem: any) => ({
        sys_id: categoryItem.sys_id || "",
        title: categoryItem.title || "",
        description: categoryItem.description || "",
        parent: categoryItem.parent || "",
        icon: categoryItem.icon || "",
        active: categoryItem.active || "",
        order: categoryItem.order || "",
      }));

      return toContextItem(extras, "Catalog categories list", {
        success: true,
        message: `Retrieved ${categories.length} catalog categories`,
        categories,
        total: categories.length,
        limit,
        offset,
      });
    }

    case BuiltInToolNames.ServiceNowCreateCatalogCategory: {
      const title = getStringArg(args, "title");
      const payload: any = { title };
      const description = getOptionalStringArg(args, "description");
      const parent = getOptionalStringArg(args, "parent");
      const icon = getOptionalStringArg(args, "icon");
      const active = getBooleanArg(args, "active", false);
      const order =
        typeof args?.order !== "undefined"
          ? getNumberArg(args, "order")
          : undefined;

      if (description) payload.description = description;
      if (parent) payload.parent = parent;
      if (icon) payload.icon = icon;
      if (typeof active !== "undefined") {
        payload.active = String(active).toLowerCase();
      }
      if (typeof order !== "undefined") payload.order = String(order);

      const data = await serviceNowRequest(extras, config, {
        method: "POST",
        path: "/table/sc_category",
        body: payload,
      });

      return toContextItem(extras, "Catalog category created", {
        success: true,
        message: `Created catalog category: ${title}`,
        data: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowUpdateCatalogCategory: {
      const categoryId = getStringArg(args, "category_id");
      const payload: any = {};
      const fields = ["title", "description", "parent", "icon"];
      fields.forEach((field) => {
        const value = getOptionalStringArg(args, field);
        if (typeof value !== "undefined") payload[field] = value;
      });
      const active = getBooleanArg(args, "active", false);
      if (typeof active !== "undefined") {
        payload.active = String(active).toLowerCase();
      }
      if (typeof args?.order !== "undefined") {
        payload.order = String(getNumberArg(args, "order"));
      }

      const data = await serviceNowRequest(extras, config, {
        method: "PATCH",
        path: `/table/sc_category/${categoryId}`,
        body: payload,
      });

      return toContextItem(extras, "Catalog category updated", {
        success: true,
        message: `Updated catalog category: ${categoryId}`,
        data: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowMoveCatalogItems: {
      const itemIds = getStringArrayArg(args, "item_ids");
      const targetCategoryId = getStringArg(args, "target_category_id");
      const failedItems: Array<{ item_id: string; error: string }> = [];
      let successCount = 0;

      for (const itemId of itemIds) {
        try {
          await serviceNowRequest(extras, config, {
            method: "PATCH",
            path: `/table/sc_cat_item/${itemId}`,
            body: { category: targetCategoryId },
          });
          successCount += 1;
        } catch (error) {
          failedItems.push({ item_id: itemId, error: `${error}` });
        }
      }

      const message =
        successCount === itemIds.length
          ? `Successfully moved ${successCount} catalog items to category ${targetCategoryId}`
          : successCount > 0
            ? `Partially moved catalog items. ${successCount} succeeded, ${failedItems.length} failed.`
            : "Failed to move any catalog items";

      return toContextItem(extras, "Catalog items moved", {
        success: successCount > 0,
        message,
        moved_items_count: successCount,
        failed_items: failedItems,
      });
    }

    case BuiltInToolNames.ServiceNowCreateCatalogItemVariable: {
      const catalogItemId = getStringArg(args, "catalog_item_id");
      const name = getStringArg(args, "name");
      const type = getStringArg(args, "type");
      const label = getStringArg(args, "label");
      const mandatory = getBooleanArg(args, "mandatory", false) ?? false;
      const payload: any = {
        cat_item: catalogItemId,
        name,
        type,
        question_text: label,
        mandatory: String(mandatory).toLowerCase(),
      };

      const optionalFields = [
        "help_text",
        "default_value",
        "description",
        "reference_table",
        "reference_qualifier",
      ];
      optionalFields.forEach((field) => {
        const value = getOptionalStringArg(args, field);
        if (typeof value !== "undefined") {
          if (field === "reference_table") {
            payload.reference = value;
          } else if (field === "reference_qualifier") {
            payload.reference_qual = value;
          } else {
            payload[field] = value;
          }
        }
      });

      if (typeof args?.order !== "undefined") {
        payload.order = getNumberArg(args, "order");
      }
      if (typeof args?.max_length !== "undefined") {
        payload.max_length = getNumberArg(args, "max_length");
      }
      if (typeof args?.min !== "undefined") {
        payload.min = getNumberArg(args, "min");
      }
      if (typeof args?.max !== "undefined") {
        payload.max = getNumberArg(args, "max");
      }

      const data = await serviceNowRequest(extras, config, {
        method: "POST",
        path: "/table/item_option_new",
        body: payload,
      });

      return toContextItem(extras, "Catalog item variable created", {
        success: true,
        message: "Catalog item variable created successfully",
        variable_id: data?.result?.sys_id,
        details: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowListCatalogItemVariables: {
      const catalogItemId = getStringArg(args, "catalog_item_id");
      const includeDetails =
        getBooleanArg(args, "include_details", false) ?? true;
      const limit = getOptionalNumberArg(args, "limit");
      const offset = getOptionalNumberArg(args, "offset");

      const query: Record<string, string> = {
        sysparm_query: `cat_item=${catalogItemId}^ORDERBYorder`,
      };
      if (includeDetails) {
        query.sysparm_display_value = "true";
        query.sysparm_exclude_reference_link = "false";
      } else {
        query.sysparm_fields = "sys_id,name,type,question_text,order,mandatory";
      }
      if (typeof limit !== "undefined") query.sysparm_limit = String(limit);
      if (typeof offset !== "undefined") query.sysparm_offset = String(offset);

      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/item_option_new",
        query,
      });

      const variables = data?.result || [];
      return toContextItem(extras, "Catalog item variables list", {
        success: true,
        message: `Retrieved ${variables.length} variables for catalog item`,
        variables,
        count: variables.length,
      });
    }

    case BuiltInToolNames.ServiceNowUpdateCatalogItemVariable: {
      const variableId = getStringArg(args, "variable_id");
      const payload: any = {};
      const label = getOptionalStringArg(args, "label");
      if (typeof label !== "undefined") payload.question_text = label;
      const mandatory = getBooleanArg(args, "mandatory", false);
      if (typeof mandatory !== "undefined") {
        payload.mandatory = String(mandatory).toLowerCase();
      }
      const helpText = getOptionalStringArg(args, "help_text");
      if (typeof helpText !== "undefined") payload.help_text = helpText;
      const defaultValue = getOptionalStringArg(args, "default_value");
      if (typeof defaultValue !== "undefined") payload.default_value = defaultValue;
      const description = getOptionalStringArg(args, "description");
      if (typeof description !== "undefined") payload.description = description;
      if (typeof args?.order !== "undefined") payload.order = getNumberArg(args, "order");
      const referenceQualifier = getOptionalStringArg(args, "reference_qualifier");
      if (typeof referenceQualifier !== "undefined") payload.reference_qual = referenceQualifier;
      if (typeof args?.max_length !== "undefined") payload.max_length = getNumberArg(args, "max_length");
      if (typeof args?.min !== "undefined") payload.min = getNumberArg(args, "min");
      if (typeof args?.max !== "undefined") payload.max = getNumberArg(args, "max");

      if (Object.keys(payload).length === 0) {
        return toContextItem(extras, "Catalog item variable update skipped", {
          success: false,
          message: "No update parameters provided",
        });
      }

      const data = await serviceNowRequest(extras, config, {
        method: "PATCH",
        path: `/table/item_option_new/${variableId}`,
        body: payload,
      });

      return toContextItem(extras, "Catalog item variable updated", {
        success: true,
        message: "Catalog item variable updated successfully",
        variable_id: variableId,
        details: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowListCatalogs: {
      const limit = getOptionalNumberArg(args, "limit", 10) ?? 10;
      const offset = getOptionalNumberArg(args, "offset", 0) ?? 0;
      const query = getOptionalStringArg(args, "query");
      const active =
        typeof args?.active !== "undefined"
          ? getBooleanArg(args, "active", true)
          : true;

      const filters: string[] = [];
      if (typeof active !== "undefined") {
        filters.push(`active=${String(active).toLowerCase()}`);
      }
      if (query) {
        filters.push(`titleLIKE${query}^ORdescriptionLIKE${query}`);
      }

      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/sc_catalog",
        query: {
          sysparm_limit: String(limit),
          sysparm_offset: String(offset),
          sysparm_display_value: "true",
          sysparm_exclude_reference_link: "true",
          ...(filters.length ? { sysparm_query: filters.join("^") } : {}),
        },
      });

      const catalogs = (data?.result || []).map((catalog: any) => ({
        sys_id: catalog.sys_id || "",
        title: catalog.title || "",
        description: catalog.description || "",
        active: catalog.active || "",
        order: catalog.order || "",
      }));

      return toContextItem(extras, "Catalogs list", {
        success: true,
        message: `Retrieved ${catalogs.length} catalogs`,
        catalogs,
        total: catalogs.length,
        limit,
        offset,
      });
    }

    case BuiltInToolNames.ServiceNowCreateChangeRequest: {
      const shortDescription = getStringArg(args, "short_description");
      const type = getStringArg(args, "type");
      const payload: any = {
        short_description: shortDescription,
        type,
      };
      const fields = [
        "description",
        "risk",
        "impact",
        "category",
        "requested_by",
        "assignment_group",
        "start_date",
        "end_date",
      ];
      fields.forEach((field) => {
        const value = getOptionalStringArg(args, field);
        if (typeof value !== "undefined") payload[field] = value;
      });

      const data = await serviceNowRequest(extras, config, {
        method: "POST",
        path: "/table/change_request",
        body: payload,
      });

      return toContextItem(extras, "Change request created", {
        success: true,
        message: "Change request created successfully",
        change_request: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowUpdateChangeRequest: {
      const changeId = getStringArg(args, "change_id");
      const payload: any = {};
      const fields = [
        "short_description",
        "description",
        "state",
        "risk",
        "impact",
        "category",
        "assignment_group",
        "start_date",
        "end_date",
        "work_notes",
      ];
      fields.forEach((field) => {
        const value = getOptionalStringArg(args, field);
        if (typeof value !== "undefined") payload[field] = value;
      });

      const data = await serviceNowRequest(extras, config, {
        method: "PUT",
        path: `/table/change_request/${changeId}`,
        body: payload,
      });

      return toContextItem(extras, "Change request updated", {
        success: true,
        message: "Change request updated successfully",
        change_request: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowListChangeRequests: {
      const limit = getOptionalNumberArg(args, "limit", 10) ?? 10;
      const offset = getOptionalNumberArg(args, "offset", 0) ?? 0;
      const filters: string[] = [];
      const state = getOptionalStringArg(args, "state");
      const type = getOptionalStringArg(args, "type");
      const category = getOptionalStringArg(args, "category");
      const assignmentGroup = getOptionalStringArg(args, "assignment_group");
      const timeframe = getOptionalStringArg(args, "timeframe");
      const query = getOptionalStringArg(args, "query");

      if (state) filters.push(`state=${state}`);
      if (type) filters.push(`type=${type}`);
      if (category) filters.push(`category=${category}`);
      if (assignmentGroup) filters.push(`assignment_group=${assignmentGroup}`);

      if (timeframe) {
        const now = formatDateTime(new Date());
        if (timeframe === "upcoming") {
          filters.push(`start_date>${now}`);
        } else if (timeframe === "in-progress") {
          filters.push(`start_date<${now}^end_date>${now}`);
        } else if (timeframe === "completed") {
          filters.push(`end_date<${now}`);
        }
      }

      if (query) filters.push(query);

      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/change_request",
        query: {
          sysparm_limit: String(limit),
          sysparm_offset: String(offset),
          sysparm_query: filters.join("^"),
          sysparm_display_value: "true",
        },
      });

      const changeRequests = data?.result || [];
      return toContextItem(extras, "Change requests list", {
        success: true,
        change_requests: changeRequests,
        count: changeRequests.length,
        total: changeRequests.length,
      });
    }

    case BuiltInToolNames.ServiceNowGetChangeRequestDetails: {
      const changeId = getStringArg(args, "change_id");
      const change = await serviceNowRequest(extras, config, {
        method: "GET",
        path: `/table/change_request/${changeId}`,
        query: { sysparm_display_value: "true" },
      });
      const tasks = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/change_task",
        query: {
          sysparm_query: `change_request=${changeId}`,
          sysparm_display_value: "true",
        },
      });

      return toContextItem(extras, "Change request details", {
        success: true,
        change_request: change?.result || {},
        tasks: tasks?.result || [],
      });
    }

    case BuiltInToolNames.ServiceNowAddChangeTask: {
      const changeId = getStringArg(args, "change_id");
      const shortDescription = getStringArg(args, "short_description");
      const payload: any = {
        change_request: changeId,
        short_description: shortDescription,
      };
      const description = getOptionalStringArg(args, "description");
      const assignedTo = getOptionalStringArg(args, "assigned_to");
      const plannedStart = getOptionalStringArg(args, "planned_start_date");
      const plannedEnd = getOptionalStringArg(args, "planned_end_date");
      if (description) payload.description = description;
      if (assignedTo) payload.assigned_to = assignedTo;
      if (plannedStart) payload.planned_start_date = plannedStart;
      if (plannedEnd) payload.planned_end_date = plannedEnd;

      const data = await serviceNowRequest(extras, config, {
        method: "POST",
        path: "/table/change_task",
        body: payload,
      });

      return toContextItem(extras, "Change task created", {
        success: true,
        message: "Change task added successfully",
        change_task: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowSubmitChangeForApproval: {
      const changeId = getStringArg(args, "change_id");
      const approvalComments = getOptionalStringArg(args, "approval_comments");
      const payload: any = { state: "assess" };
      if (approvalComments) payload.work_notes = approvalComments;

      await serviceNowRequest(extras, config, {
        method: "PATCH",
        path: `/table/change_request/${changeId}`,
        body: payload,
      });

      const approval = await serviceNowRequest(extras, config, {
        method: "POST",
        path: "/table/sysapproval_approver",
        body: {
          document_id: changeId,
          source_table: "change_request",
          state: "requested",
        },
      });

      return toContextItem(extras, "Change submitted for approval", {
        success: true,
        message: "Change request submitted for approval successfully",
        approval: approval?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowApproveChange: {
      const changeId = getStringArg(args, "change_id");
      const approvalComments = getOptionalStringArg(args, "approval_comments");

      const approvalQuery = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/sysapproval_approver",
        query: {
          sysparm_query: `document_id=${changeId}`,
          sysparm_limit: "1",
        },
      });

      const approvalRecord = approvalQuery?.result?.[0];
      if (!approvalRecord) {
        return toContextItem(extras, "Approval record not found", {
          success: false,
          message: "No approval record found for this change request",
        });
      }

      const approvalPayload: any = { state: "approved" };
      if (approvalComments) approvalPayload.comments = approvalComments;

      await serviceNowRequest(extras, config, {
        method: "PATCH",
        path: `/table/sysapproval_approver/${approvalRecord.sys_id}`,
        body: approvalPayload,
      });

      await serviceNowRequest(extras, config, {
        method: "PATCH",
        path: `/table/change_request/${changeId}`,
        body: { state: "implement" },
      });

      return toContextItem(extras, "Change approved", {
        success: true,
        message: "Change request approved successfully",
      });
    }

    case BuiltInToolNames.ServiceNowRejectChange: {
      const changeId = getStringArg(args, "change_id");
      const rejectionReason = getStringArg(args, "rejection_reason");

      const approvalQuery = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/sysapproval_approver",
        query: {
          sysparm_query: `document_id=${changeId}`,
          sysparm_limit: "1",
        },
      });

      const approvalRecord = approvalQuery?.result?.[0];
      if (!approvalRecord) {
        return toContextItem(extras, "Approval record not found", {
          success: false,
          message: "No approval record found for this change request",
        });
      }

      await serviceNowRequest(extras, config, {
        method: "PATCH",
        path: `/table/sysapproval_approver/${approvalRecord.sys_id}`,
        body: { state: "rejected", comments: rejectionReason },
      });

      await serviceNowRequest(extras, config, {
        method: "PATCH",
        path: `/table/change_request/${changeId}`,
        body: {
          state: "canceled",
          work_notes: `Change request rejected: ${rejectionReason}`,
        },
      });

      return toContextItem(extras, "Change rejected", {
        success: true,
        message: "Change request rejected successfully",
      });
    }

    case BuiltInToolNames.ServiceNowCreateTask: {
      const fields = getFieldsArg(args, "fields");
      const data = await serviceNowRequest(extras, config, {
        method: "POST",
        path: "/table/task",
        body: fields,
      });
      return toContextItem(extras, "Task created", {
        success: true,
        message: "Task created successfully",
        task: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowUpdateTask: {
      const taskId = getStringArg(args, "task_id");
      const fields = getFieldsArg(args, "fields");
      if (!Object.keys(fields).length) {
        return toContextItem(extras, "Task update skipped", {
          success: false,
          message: "No update fields provided",
        });
      }
      const sysId = await resolveRecordSysId(extras, config, "task", taskId);
      const data = await serviceNowRequest(extras, config, {
        method: "PATCH",
        path: `/table/task/${sysId}`,
        body: fields,
      });
      return toContextItem(extras, "Task updated", {
        success: true,
        message: "Task updated successfully",
        task: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowGetTask: {
      const taskId = getStringArg(args, "task_id");
      const sysId = await resolveRecordSysId(extras, config, "task", taskId);
      const query = getRecordQueryParams(args);
      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: `/table/task/${sysId}`,
        query,
      });
      const task = data?.result;
      if (!task) {
        return toContextItem(extras, "Task not found", {
          success: false,
          message: `Task not found: ${taskId}`,
        });
      }
      return toContextItem(extras, "Task details", {
        success: true,
        task,
      });
    }

    case BuiltInToolNames.ServiceNowListTasks: {
      const { queryParams, limit, offset } = getListQueryParams(args);
      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/task",
        query: queryParams,
      });
      const tasks = data?.result || [];
      return toContextItem(extras, "Tasks list", {
        success: true,
        message: `Retrieved ${tasks.length} tasks`,
        tasks,
        total: tasks.length,
        limit,
        offset,
      });
    }

    case BuiltInToolNames.ServiceNowCreateProblemTask: {
      const fields = getFieldsArg(args, "fields");
      const data = await serviceNowRequest(extras, config, {
        method: "POST",
        path: "/table/problem_task",
        body: fields,
      });
      return toContextItem(extras, "Problem task created", {
        success: true,
        message: "Problem task created successfully",
        problem_task: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowUpdateProblemTask: {
      const problemTaskId = getStringArg(args, "problem_task_id");
      const fields = getFieldsArg(args, "fields");
      if (!Object.keys(fields).length) {
        return toContextItem(extras, "Problem task update skipped", {
          success: false,
          message: "No update fields provided",
        });
      }
      const sysId = await resolveRecordSysId(
        extras,
        config,
        "problem_task",
        problemTaskId,
      );
      const data = await serviceNowRequest(extras, config, {
        method: "PATCH",
        path: `/table/problem_task/${sysId}`,
        body: fields,
      });
      return toContextItem(extras, "Problem task updated", {
        success: true,
        message: "Problem task updated successfully",
        problem_task: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowGetProblemTask: {
      const problemTaskId = getStringArg(args, "problem_task_id");
      const sysId = await resolveRecordSysId(
        extras,
        config,
        "problem_task",
        problemTaskId,
      );
      const query = getRecordQueryParams(args);
      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: `/table/problem_task/${sysId}`,
        query,
      });
      const problemTask = data?.result;
      if (!problemTask) {
        return toContextItem(extras, "Problem task not found", {
          success: false,
          message: `Problem task not found: ${problemTaskId}`,
        });
      }
      return toContextItem(extras, "Problem task details", {
        success: true,
        problem_task: problemTask,
      });
    }

    case BuiltInToolNames.ServiceNowListProblemTasks: {
      const { queryParams, limit, offset } = getListQueryParams(args);
      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/problem_task",
        query: queryParams,
      });
      const problemTasks = data?.result || [];
      return toContextItem(extras, "Problem tasks list", {
        success: true,
        message: `Retrieved ${problemTasks.length} problem tasks`,
        problem_tasks: problemTasks,
        total: problemTasks.length,
        limit,
        offset,
      });
    }

    case BuiltInToolNames.ServiceNowCreateScTask: {
      const fields = getFieldsArg(args, "fields");
      const data = await serviceNowRequest(extras, config, {
        method: "POST",
        path: "/table/sc_task",
        body: fields,
      });
      return toContextItem(extras, "Catalog task created", {
        success: true,
        message: "Catalog task created successfully",
        sc_task: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowUpdateScTask: {
      const scTaskId = getStringArg(args, "sc_task_id");
      const fields = getFieldsArg(args, "fields");
      if (!Object.keys(fields).length) {
        return toContextItem(extras, "Catalog task update skipped", {
          success: false,
          message: "No update fields provided",
        });
      }
      const sysId = await resolveRecordSysId(
        extras,
        config,
        "sc_task",
        scTaskId,
      );
      const data = await serviceNowRequest(extras, config, {
        method: "PATCH",
        path: `/table/sc_task/${sysId}`,
        body: fields,
      });
      return toContextItem(extras, "Catalog task updated", {
        success: true,
        message: "Catalog task updated successfully",
        sc_task: data?.result || {},
      });
    }

    case BuiltInToolNames.ServiceNowGetScTask: {
      const scTaskId = getStringArg(args, "sc_task_id");
      const sysId = await resolveRecordSysId(
        extras,
        config,
        "sc_task",
        scTaskId,
      );
      const query = getRecordQueryParams(args);
      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: `/table/sc_task/${sysId}`,
        query,
      });
      const scTask = data?.result;
      if (!scTask) {
        return toContextItem(extras, "Catalog task not found", {
          success: false,
          message: `Catalog task not found: ${scTaskId}`,
        });
      }
      return toContextItem(extras, "Catalog task details", {
        success: true,
        sc_task: scTask,
      });
    }

    case BuiltInToolNames.ServiceNowListScTasks: {
      const { queryParams, limit, offset } = getListQueryParams(args);
      const data = await serviceNowRequest(extras, config, {
        method: "GET",
        path: "/table/sc_task",
        query: queryParams,
      });
      const scTasks = data?.result || [];
      return toContextItem(extras, "Catalog tasks list", {
        success: true,
        message: `Retrieved ${scTasks.length} catalog tasks`,
        sc_tasks: scTasks,
        total: scTasks.length,
        limit,
        offset,
      });
    }

    default:
      throw new Error(`Unknown ServiceNow tool: ${functionName}`);
  }
}
