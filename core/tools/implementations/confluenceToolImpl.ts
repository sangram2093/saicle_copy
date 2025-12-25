import { ContextItem, ToolExtras } from "../..";
import { BuiltInToolNames } from "../builtIn";

// Set NODE_TLS_REJECT_UNAUTHORIZED to 0 for Confluence API calls
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Helper function to get string argument
function getStringArg(args: any, key: string): string {
  const value = args?.[key];
  if (typeof value !== "string") {
    throw new Error(`Missing or invalid string argument: ${key}`);
  }
  return value;
}

// Helper function to get optional string argument
function getOptionalStringArg(
  args: any,
  key: string,
  trim: boolean = false,
): string | undefined {
  const value = args?.[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Invalid string argument: ${key}`);
  }
  return trim ? value.trim() : value;
}

// Helper function to get number argument
function getNumberArg(args: any, key: string): number {
  const value = args?.[key];
  if (typeof value !== "number") {
    throw new Error(`Missing or invalid number argument: ${key}`);
  }
  return value;
}

// Helper function to get optional number argument
function getOptionalNumberArg(
  args: any,
  key: string,
  defaultValue?: number,
): number {
  const value = args?.[key];
  if (value === undefined || value === null) {
    return defaultValue ?? 0;
  }
  if (typeof value !== "number") {
    throw new Error(`Invalid number argument: ${key}`);
  }
  return value;
}

// Helper to get Confluence config
function getConfluenceConfig(config: any) {
  const confluenceConfig = config.confluence;
  if (!confluenceConfig) {
    throw new Error("Confluence configuration not found in config");
  }
  if (!confluenceConfig.userEmail || !confluenceConfig.apiToken) {
    throw new Error("Confluence userEmail and apiToken are required");
  }
  return confluenceConfig;
}

// Helper to build Authorization headers (try Bearer then Basic)
function buildAuthHeaders(userEmail: string, apiToken: string): string[] {
  const bearer = `Bearer ${apiToken}`;
  const basic = `Basic ${Buffer.from(`${userEmail}:${apiToken}`).toString("base64")}`;
  return [bearer, basic];
}

// Helper to fetch from Confluence API
async function confluenceApiFetch(
  path: string,
  baseUrl: string,
  auth: string | string[],
  method: string = "GET",
  body?: any,
): Promise<any> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const authHeaders = Array.isArray(auth) ? auth : [auth];
  let lastError: string | undefined;

  for (const authHeader of authHeaders) {
    const headers: any = {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const options: any = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (response.ok) {
      return response.json();
    }

    const errorText = await response.text();
    lastError = `Confluence API error (${response.status}): ${errorText}`;
    if ((response.status === 401 || response.status === 403) && authHeaders.length > 1) {
      continue;
    }
    throw new Error(lastError);
  }

  throw new Error(lastError || "Confluence API error: authorization failed");
}

// 1. Search Confluence using CQL
export async function confluence_searchCQL(
  cql: string,
  baseUrl: string,
  auth: string | string[],
  limit: number = 25,
  start: number = 0,
): Promise<any> {
  const params = new URLSearchParams({
    cql,
    limit: limit.toString(),
    start: start.toString(),
    expand: "space,version,container",
  });

  return confluenceApiFetch(
    `/rest/api/content/search?${params}`,
    baseUrl,
    auth,
  );
}

// 2. List Confluence spaces
export async function confluence_listSpaces(
  baseUrl: string,
  auth: string | string[],
  limit: number = 25,
  start: number = 0,
): Promise<any> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    start: start.toString(),
    expand: "description.plain,icon",
  });

  return confluenceApiFetch(`/rest/api/space?${params}`, baseUrl, auth);
}

// 3. Get space details
export async function confluence_getSpaceDetails(
  spaceKey: string,
  baseUrl: string,
  auth: string | string[],
): Promise<any> {
  return confluenceApiFetch(
    `/rest/api/space/${encodeURIComponent(spaceKey)}?expand=description.plain,icon`,
    baseUrl,
    auth,
  );
}

// 4. List pages in a space
export async function confluence_listPages(
  spaceId: number,
  baseUrl: string,
  auth: string | string[],
  limit: number = 25,
  start: number = 0,
): Promise<any> {
  const params = new URLSearchParams({
    spaceId: spaceId.toString(),
    limit: limit.toString(),
    start: start.toString(),
    expand: "space,version",
  });

  return confluenceApiFetch(`/rest/api/content?${params}`, baseUrl, auth);
}

// 5. Get page details
export async function confluence_getPageDetails(
  pageId: number,
  baseUrl: string,
  auth: string | string[],
): Promise<any> {
  return confluenceApiFetch(
    `/rest/api/content/${pageId}?expand=space,version,body.storage`,
    baseUrl,
    auth,
  );
}

// 6. Get page content in markdown with images
export async function confluence_getPageContent(
  pageId: number,
  baseUrl: string,
  auth: string | string[],
): Promise<{
  markdown: string;
  images: Array<{ url: string; base64: string; filename: string }>;
}> {
  const pageDetails = await confluence_getPageDetails(pageId, baseUrl, auth);

  // Convert storage format to markdown
  const markdown = convertStorageFormatToMarkdown(
    pageDetails.body.storage.value,
  );

  // Extract image URLs
  const imageUrls = extractImageUrls(pageDetails.body.storage.value);

  // Convert images to base64
  const images = await Promise.all(
    imageUrls.map(async (imageUrl) => {
      try {
        const base64 = await downloadImageAsBase64(imageUrl, auth);
        const filename = imageUrl.split("/").pop() || "image";
        return { url: imageUrl, base64, filename };
      } catch (error) {
        console.error(`Failed to download image: ${imageUrl}`, error);
        return { url: imageUrl, base64: "", filename: "" };
      }
    }),
  );

  return { markdown, images: images.filter((img) => img.base64) };
}

// 7. Create a page
export async function confluence_createPage(
  spaceId: number | undefined,
  spaceKey: string | undefined,
  title: string,
  content: string,
  baseUrl: string,
  auth: string | string[],
  parentPageId?: number,
  diagramCode?: string,
  introHtml?: string,
  contentFormat?: string,
): Promise<any> {
  // Build storage format content
  const format = (contentFormat || "markdown").toLowerCase();
  let storageFormat =
    format === "storage" ? content : convertMarkdownToStorageFormat(content);

  if (diagramCode && diagramCode.trim().length > 0) {
    const macro = buildConfluenceMacro(diagramCode, introHtml);
    storageFormat = `${storageFormat || ""}\n${macro}`.trim();
  }

  const body: any = {
    type: "page",
    title,
    space: spaceKey ? { key: spaceKey } : { id: spaceId },
    body: { storage: { value: storageFormat, representation: "storage" } },
  };

  if (parentPageId) {
    body.ancestors = [{ id: parentPageId }];
  }

  const result = await confluenceApiFetch(
    `/rest/api/content`,
    baseUrl,
    auth,
    "POST",
    body,
  );

  // Add label if page created successfully
  if (result && result.id) {
    await confluence_ensureLabelOnPage(result.id, baseUrl, auth);
  }

  return result;
}

// 8. Add PlantUML diagram to page
export async function confluence_addDiagram(
  pageId: number,
  diagramCode: string,
  baseUrl: string,
  auth: string | string[],
  diagramTitle?: string,
  introHtml?: string,
): Promise<any> {
  // Get current page to modify it
  const currentPage = await confluence_getPageDetails(pageId, baseUrl, auth);

  // Create PlantUML macro (optionally with a title)
  const diagramMacro = buildConfluenceMacro(diagramCode, introHtml, diagramTitle);

  // Append to existing content
  const updatedContent = currentPage.body.storage.value + "\n" + diagramMacro;

  const updateBody = {
    type: "page",
    title: currentPage.title,
    body: { storage: { value: updatedContent, representation: "storage" } },
    version: { number: currentPage.version.number + 1 },
  };

  const result = await confluenceApiFetch(
    `/rest/api/content/${pageId}`,
    baseUrl,
    auth,
    "PUT",
    updateBody,
  );

  // Add label if diagram added successfully
  if (result) {
    await confluence_ensureLabelOnPage(pageId, baseUrl, auth);
  }

  return result;
}

// 9. Modify page content
export async function confluence_modifyPageContent(
  pageId: number,
  content: string,
  baseUrl: string,
  auth: string | string[],
): Promise<any> {
  // Get current page
  const currentPage = await confluence_getPageDetails(pageId, baseUrl, auth);

  // Convert markdown to Confluence storage format
  const storageFormat = convertMarkdownToStorageFormat(content);

  const updateBody = {
    type: "page",
    title: currentPage.title,
    body: { storage: { value: storageFormat, representation: "storage" } },
    version: { number: currentPage.version.number + 1 },
  };

  const result = await confluenceApiFetch(
    `/rest/api/content/${pageId}`,
    baseUrl,
    auth,
    "PUT",
    updateBody,
  );

  // Add label if page modified successfully
  if (result) {
    await confluence_ensureLabelOnPage(pageId, baseUrl, auth);
  }

  return result;
}

// 10. Add label to page
export async function confluence_addPageLabel(
  pageId: number,
  label: string,
  baseUrl: string,
  auth: string | string[],
): Promise<any> {
  const url = `/rest/api/content/${pageId}/label`;
  const body = {
    prefix: "global",
    name: label,
  };

  return confluenceApiFetch(url, baseUrl, auth, "POST", body);
}

// 11. Ensure label on page (idempotent - adds db_ai_in_use if not present)
export async function confluence_ensureLabelOnPage(
  pageId: number,
  baseUrl: string,
  auth: string | string[],
): Promise<boolean> {
  const DB_AI_LABEL = "db_ai_in_use";
  try {
    // Try to add the label - Confluence API is idempotent for labels
    // Adding an existing label returns success without error
    await confluence_addPageLabel(pageId, DB_AI_LABEL, baseUrl, auth);
    return true;
  } catch (error) {
    console.error(`Failed to ensure label on page ${pageId}:`, error);
    return false;
  }
}

// Helper: Convert Confluence storage format to markdown
function convertStorageFormatToMarkdown(storageHtml: string): string {
  let markdown = storageHtml;

  // Convert headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/g, "# $1");
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/g, "## $1");
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/g, "### $1");
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/g, "#### $1");
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/g, "##### $1");
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/g, "###### $1");

  // Convert bold
  markdown = markdown.replace(/<strong>(.*?)<\/strong>/g, "**$1**");
  markdown = markdown.replace(/<b>(.*?)<\/b>/g, "**$1**");

  // Convert italic
  markdown = markdown.replace(/<em>(.*?)<\/em>/g, "*$1*");
  markdown = markdown.replace(/<i>(.*?)<\/i>/g, "*$1*");

  // Convert links
  markdown = markdown.replace(
    /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g,
    "[$2]($1)",
  );

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/g, "\n");

  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/g, "$1\n\n");

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]*>/g, "");

  // Decode HTML entities
  markdown = markdown
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return markdown.trim();
}

// Helper: Convert markdown to Confluence storage format
function convertMarkdownToStorageFormat(markdown: string): string {
  let storage = markdown;

  // Convert headings
  storage = storage.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
  storage = storage.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
  storage = storage.replace(/^# (.*?)$/gm, "<h1>$1</h1>");

  // Convert bold
  storage = storage.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert italic
  storage = storage.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Convert links
  storage = storage.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

  // Convert line breaks
  storage = storage.replace(/\n\n/g, "</p><p>");
  storage = `<p>${storage}</p>`;

  return storage;
}

function buildConfluenceMacro(
  plantumlText: string,
  introHtml?: string,
  diagramTitle?: string,
): string {
  const intro = introHtml || "<p>Auto-generated graph.</p>";
  const titleParam = diagramTitle
    ? `<ac:parameter ac:name="title">${diagramTitle}</ac:parameter>\n`
    : "";
  return `${intro}
<ac:structured-macro ac:name="plantuml">
  ${titleParam}<ac:plain-text-body><![CDATA[
${plantumlText}
  ]]></ac:plain-text-body>
</ac:structured-macro>
`;
}

// Helper: Extract image URLs from storage format
function extractImageUrls(storageHtml: string): string[] {
  const imageUrls: string[] = [];
  const imgRegex = /<img[^>]*src="([^"]*)"[^>]*>/g;
  let match;

  while ((match = imgRegex.exec(storageHtml)) !== null) {
    imageUrls.push(match[1]);
  }

  return imageUrls;
}

// Helper: Download image and convert to base64
async function downloadImageAsBase64(
  imageUrl: string,
  auth: string | string[],
): Promise<string> {
  const authHeaders = Array.isArray(auth) ? auth : [auth];
  let lastError: string | undefined;

  for (const authHeader of authHeaders) {
    const response = await fetch(imageUrl, {
      headers: {
        Authorization: authHeader,
      },
    });

    if (response.ok) {
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString("base64");
    }

    lastError = `Failed to download image: ${response.statusText}`;
    if ((response.status === 401 || response.status === 403) && authHeaders.length > 1) {
      continue;
    }
    throw new Error(lastError);
  }

  throw new Error(lastError || "Failed to download image: authorization failed");
}

// Query/read-only Confluence tools
export async function handleConfluenceQueryTools(
  functionName: BuiltInToolNames,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const confluenceConfig = getConfluenceConfig(extras.config);
  const auth = buildAuthHeaders(
    confluenceConfig.userEmail,
    confluenceConfig.apiToken,
  );
  const baseUrl =
    confluenceConfig.confluenceBaseUrl || "https://confluence.intranet.db.com/";

  switch (functionName) {
    case BuiltInToolNames.ConfluenceSearchCQL: {
      const cql = getStringArg(args, "cql");
      const limit = getOptionalNumberArg(args, "limit", 25);
      const start = getOptionalNumberArg(args, "start", 0);
      const results = await confluence_searchCQL(
        cql,
        baseUrl,
        auth,
        limit,
        start,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Confluence CQL search results`,
          content: JSON.stringify(results, null, 2),
          icon: extras.tool.faviconUrl,
        },
      ];
    }

    case BuiltInToolNames.ConfluenceListSpaces: {
      const limit = getOptionalNumberArg(args, "limit", 25);
      const start = getOptionalNumberArg(args, "start", 0);
      const spaces = await confluence_listSpaces(baseUrl, auth, limit, start);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Confluence spaces`,
          content: JSON.stringify(spaces, null, 2),
          icon: extras.tool.faviconUrl,
        },
      ];
    }

    case BuiltInToolNames.ConfluenceGetSpaceDetails: {
      const spaceKey = getStringArg(args, "spaceKey");
      const details = await confluence_getSpaceDetails(spaceKey, baseUrl, auth);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Space details: ${spaceKey}`,
          content: JSON.stringify(details, null, 2),
          icon: extras.tool.faviconUrl,
        },
      ];
    }

    case BuiltInToolNames.ConfluenceListPages: {
      const spaceId = getNumberArg(args, "spaceId");
      const limit = getOptionalNumberArg(args, "limit", 25);
      const start = getOptionalNumberArg(args, "start", 0);
      const pages = await confluence_listPages(
        spaceId,
        baseUrl,
        auth,
        limit,
        start,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Pages in space ${spaceId}`,
          content: JSON.stringify(pages, null, 2),
          icon: extras.tool.faviconUrl,
        },
      ];
    }

    case BuiltInToolNames.ConfluenceGetPageDetails: {
      const pageId = getNumberArg(args, "pageId");
      const details = await confluence_getPageDetails(pageId, baseUrl, auth);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Page details: ${pageId}`,
          content: JSON.stringify(details, null, 2),
          icon: extras.tool.faviconUrl,
        },
      ];
    }

    case BuiltInToolNames.ConfluenceGetPageContent: {
      const pageId = getNumberArg(args, "pageId");
      const content = await confluence_getPageContent(pageId, baseUrl, auth);
      return [
        {
          name: extras.tool.displayTitle,
          description: `Page content: ${pageId}`,
          content: JSON.stringify(content, null, 2),
          icon: extras.tool.faviconUrl,
        },
      ];
    }

    default:
      throw new Error(`Unknown Confluence query tool: ${functionName}`);
  }
}

// Mutating Confluence tools
export async function handleConfluenceMutatingTools(
  functionName: BuiltInToolNames,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const confluenceConfig = getConfluenceConfig(extras.config);
  const auth = buildAuthHeaders(
    confluenceConfig.userEmail,
    confluenceConfig.apiToken,
  );
  const baseUrl =
    confluenceConfig.confluenceBaseUrl || "https://confluence.intranet.db.com/";

  switch (functionName) {
    case BuiltInToolNames.ConfluenceCreatePage: {
      const spaceId =
        typeof args?.spaceId !== "undefined"
          ? getNumberArg(args, "spaceId")
          : undefined;
      const spaceKey = getOptionalStringArg(args, "spaceKey", true);
      const title = getStringArg(args, "title");
      const content = getOptionalStringArg(args, "content") || "";
      const contentFormat = getOptionalStringArg(args, "contentFormat", true);
      const parentPageId = getOptionalNumberArg(args, "parentPageId");
      const diagramCode = getOptionalStringArg(args, "diagramCode");
      const introHtml = getOptionalStringArg(args, "introHtml");
      if (!spaceId && !spaceKey) {
        throw new Error("Provide either spaceId or spaceKey to create a page.");
      }
      const result = await confluence_createPage(
        spaceId,
        spaceKey,
        title,
        content,
        baseUrl,
        auth,
        parentPageId || undefined,
        diagramCode || undefined,
        introHtml || undefined,
        contentFormat || undefined,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Created page: ${title}`,
          content: JSON.stringify(result, null, 2),
          icon: extras.tool.faviconUrl,
        },
      ];
    }

    case BuiltInToolNames.ConfluenceAddDiagram: {
      const pageId = getNumberArg(args, "pageId");
      const diagramCode = getStringArg(args, "diagramCode");
      const diagramTitle = getOptionalStringArg(args, "diagramTitle");
      const introHtml = getOptionalStringArg(args, "introHtml");
      const result = await confluence_addDiagram(
        pageId,
        diagramCode,
        baseUrl,
        auth,
        diagramTitle,
        introHtml || undefined,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Added diagram to page ${pageId}`,
          content: JSON.stringify(result, null, 2),
          icon: extras.tool.faviconUrl,
        },
      ];
    }

    case BuiltInToolNames.ConfluenceModifyPageContent: {
      const pageId = getNumberArg(args, "pageId");
      const content = getStringArg(args, "content");
      const result = await confluence_modifyPageContent(
        pageId,
        content,
        baseUrl,
        auth,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Modified content of page ${pageId}`,
          content: JSON.stringify(result, null, 2),
          icon: extras.tool.faviconUrl,
        },
      ];
    }

    case BuiltInToolNames.ConfluenceAddPageLabel: {
      const pageId = getNumberArg(args, "pageId");
      const label = getStringArg(args, "label");
      const result = await confluence_addPageLabel(
        pageId,
        label,
        baseUrl,
        auth,
      );
      return [
        {
          name: extras.tool.displayTitle,
          description: `Added label "${label}" to page ${pageId}`,
          content: JSON.stringify(result, null, 2),
          icon: extras.tool.faviconUrl,
        },
      ];
    }

    default:
      throw new Error(`Unknown Confluence mutating tool: ${functionName}`);
  }
}
