import { Tool } from "../..";
import { BuiltInToolNames } from "../builtIn";

const confluenceBase: Partial<Tool> = {
  faviconUrl: "https://www.atlassian.com/favicon.ico",
};

export const confluenceSearchCQLTool: Tool = {
  ...(confluenceBase as any),
  displayTitle: "Confluence: Search (CQL)",
  wouldLikeTo: "search Confluence using CQL {{{ cql }}}",
  isCurrently: "searching Confluence",
  hasAlready: "searched Confluence",
  function: {
    name: BuiltInToolNames.ConfluenceSearchCQL,
    description:
      "Search Confluence pages using CQL (Confluence Query Language)",
    parameters: {
      type: "object",
      required: ["cql"],
      properties: {
        cql: { type: "string", description: "CQL query string" },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 25)",
        },
        start: {
          type: "number",
          description: "Pagination start offset (default: 0)",
        },
      },
    },
  },
};

export const confluenceListSpacesTool: Tool = {
  ...(confluenceBase as any),
  displayTitle: "Confluence: List Spaces",
  wouldLikeTo: "list all Confluence spaces accessible to user",
  isCurrently: "listing Confluence spaces",
  hasAlready: "listed Confluence spaces",
  function: {
    name: BuiltInToolNames.ConfluenceListSpaces,
    description: "List all Confluence spaces accessible to the current user",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of spaces (default: 25)",
        },
        start: {
          type: "number",
          description: "Pagination start offset (default: 0)",
        },
      },
    },
  },
};

export const confluenceGetSpaceDetailsTool: Tool = {
  ...(confluenceBase as any),
  displayTitle: "Confluence: Get Space Details",
  wouldLikeTo: "get details for Confluence space {{{ spaceKey }}}",
  isCurrently: "retrieving space details",
  hasAlready: "retrieved space details",
  function: {
    name: BuiltInToolNames.ConfluenceGetSpaceDetails,
    description: "Get detailed information about a specific Confluence space",
    parameters: {
      type: "object",
      required: ["spaceKey"],
      properties: {
        spaceKey: { type: "string", description: "The space key" },
      },
    },
  },
};

export const confluenceListPagesTool: Tool = {
  ...(confluenceBase as any),
  displayTitle: "Confluence: List Pages",
  wouldLikeTo: "list pages in Confluence space {{{ spaceKey }}}",
  isCurrently: "listing pages",
  hasAlready: "listed pages",
  function: {
    name: BuiltInToolNames.ConfluenceListPages,
    description: "List all pages within a specified Confluence space",
    parameters: {
      type: "object",
      required: ["spaceId"],
      properties: {
        spaceId: {
          type: "integer",
          description: "The space ID (integer type)",
        },
        limit: {
          type: "number",
          description: "Maximum number of pages (default: 25)",
        },
        start: {
          type: "number",
          description: "Pagination start offset (default: 0)",
        },
      },
    },
  },
};

export const confluenceGetPageDetailsTool: Tool = {
  ...(confluenceBase as any),
  displayTitle: "Confluence: Get Page Details",
  wouldLikeTo: "get details for Confluence page {{{ pageId }}}",
  isCurrently: "retrieving page details",
  hasAlready: "retrieved page details",
  function: {
    name: BuiltInToolNames.ConfluenceGetPageDetails,
    description: "Get detailed information about a specific Confluence page",
    parameters: {
      type: "object",
      required: ["pageId"],
      properties: {
        pageId: {
          type: "integer",
          description: "The page ID (integer type)",
        },
      },
    },
  },
};

export const confluenceGetPageContentTool: Tool = {
  ...(confluenceBase as any),
  displayTitle: "Confluence: Get Page Content",
  wouldLikeTo: "get content and images for Confluence page {{{ pageId }}}",
  isCurrently: "retrieving page content",
  hasAlready: "retrieved page content",
  function: {
    name: BuiltInToolNames.ConfluenceGetPageContent,
    description:
      "Get the content of a Confluence page in markdown format along with all images in base64 encoded string",
    parameters: {
      type: "object",
      required: ["pageId"],
      properties: {
        pageId: {
          type: "integer",
          description: "The page ID (integer type)",
        },
      },
    },
  },
};

export const confluenceCreatePageTool: Tool = {
  ...(confluenceBase as any),
  displayTitle: "Confluence: Create Page",
  wouldLikeTo:
    "create a new page in Confluence space {{{ spaceId }}} with title {{{ title }}}",
  isCurrently: "creating page",
  hasAlready: "created page",
  function: {
    name: BuiltInToolNames.ConfluenceCreatePage,
    description: "Create a new Confluence page from markdown content",
    parameters: {
      type: "object",
      required: ["spaceId", "title", "content"],
      properties: {
        spaceId: {
          type: "integer",
          description: "The space ID (integer type)",
        },
        title: { type: "string", description: "Page title" },
        content: {
          type: "string",
          description: "Page content in markdown format",
        },
        parentPageId: {
          type: "integer",
          description: "Parent page ID for nested pages (optional)",
        },
      },
    },
  },
};

export const confluenceAddDiagramTool: Tool = {
  ...(confluenceBase as any),
  displayTitle: "Confluence: Add Diagram",
  wouldLikeTo: "add PlantUML diagram to Confluence page {{{ pageId }}}",
  isCurrently: "adding diagram",
  hasAlready: "added diagram",
  function: {
    name: BuiltInToolNames.ConfluenceAddDiagram,
    description: "Add a PlantUML diagram to a specified Confluence page",
    parameters: {
      type: "object",
      required: ["pageId", "diagramCode"],
      properties: {
        pageId: {
          type: "integer",
          description: "The page ID (integer type)",
        },
        diagramCode: {
          type: "string",
          description: "PlantUML diagram code",
        },
        diagramTitle: {
          type: "string",
          description: "Title for the diagram (optional)",
        },
      },
    },
  },
};

export const confluenceModifyPageContentTool: Tool = {
  ...(confluenceBase as any),
  displayTitle: "Confluence: Modify Page Content",
  wouldLikeTo:
    "modify content of Confluence page {{{ pageId }}} with new markdown",
  isCurrently: "modifying page content",
  hasAlready: "modified page content",
  function: {
    name: BuiltInToolNames.ConfluenceModifyPageContent,
    description:
      "Modify the content of an existing Confluence page with new markdown content",
    parameters: {
      type: "object",
      required: ["pageId", "content"],
      properties: {
        pageId: {
          type: "integer",
          description: "The page ID (integer type)",
        },
        content: {
          type: "string",
          description: "New page content in markdown format",
        },
      },
    },
  },
};

export const confluenceAddPageLabelTool: Tool = {
  ...(confluenceBase as any),
  displayTitle: "Confluence: Add Page Label",
  wouldLikeTo: "add label {{{ label }}} to Confluence page {{{ pageId }}}",
  isCurrently: "adding page label",
  hasAlready: "added page label",
  function: {
    name: BuiltInToolNames.ConfluenceAddPageLabel,
    description: "Add a label to a Confluence page",
    parameters: {
      type: "object",
      required: ["pageId", "label"],
      properties: {
        pageId: {
          type: "integer",
          description: "The page ID (integer type)",
        },
        label: { type: "string", description: "The label to add" },
      },
    },
  },
};
