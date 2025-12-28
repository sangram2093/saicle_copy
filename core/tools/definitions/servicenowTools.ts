import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

const serviceNowBase: Partial<Tool> = {
  type: "function",
  readonly: false,
  isInstant: false,
  group: BUILT_IN_GROUP_NAME,
  defaultToolPolicy: "allowedWithPermission",
};

const serviceNowReadOnlyBase: Partial<Tool> = {
  ...serviceNowBase,
  readonly: true,
};

export const servicenowCreateIncidentTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Create Incident",
  wouldLikeTo: "create a new ServiceNow incident",
  isCurrently: "creating a ServiceNow incident",
  hasAlready: "created a ServiceNow incident",
  function: {
    name: BuiltInToolNames.ServiceNowCreateIncident,
    description: "Create a new incident in ServiceNow.",
    parameters: {
      type: "object",
      required: ["short_description"],
      properties: {
        short_description: { type: "string" },
        description: { type: "string" },
        caller_id: { type: "string" },
        category: { type: "string" },
        subcategory: { type: "string" },
        priority: { type: "string" },
        impact: { type: "string" },
        urgency: { type: "string" },
        assigned_to: { type: "string" },
        assignment_group: { type: "string" },
      },
    },
  },
};

export const servicenowUpdateIncidentTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Update Incident",
  wouldLikeTo: "update ServiceNow incident {{{ incident_id }}}",
  isCurrently: "updating a ServiceNow incident",
  hasAlready: "updated a ServiceNow incident",
  function: {
    name: BuiltInToolNames.ServiceNowUpdateIncident,
    description: "Update an existing incident in ServiceNow.",
    parameters: {
      type: "object",
      required: ["incident_id"],
      properties: {
        incident_id: { type: "string" },
        short_description: { type: "string" },
        description: { type: "string" },
        state: { type: "string" },
        category: { type: "string" },
        subcategory: { type: "string" },
        priority: { type: "string" },
        impact: { type: "string" },
        urgency: { type: "string" },
        assigned_to: { type: "string" },
        assignment_group: { type: "string" },
        work_notes: { type: "string" },
        close_notes: { type: "string" },
        close_code: { type: "string" },
      },
    },
  },
};

export const servicenowAddCommentTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Add Comment",
  wouldLikeTo: "add a comment to incident {{{ incident_id }}}",
  isCurrently: "adding a ServiceNow comment",
  hasAlready: "added a ServiceNow comment",
  function: {
    name: BuiltInToolNames.ServiceNowAddComment,
    description: "Add a comment or work note to a ServiceNow incident.",
    parameters: {
      type: "object",
      required: ["incident_id", "comment"],
      properties: {
        incident_id: { type: "string" },
        comment: { type: "string" },
        is_work_note: { type: "boolean" },
      },
    },
  },
};

export const servicenowResolveIncidentTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Resolve Incident",
  wouldLikeTo: "resolve incident {{{ incident_id }}}",
  isCurrently: "resolving a ServiceNow incident",
  hasAlready: "resolved a ServiceNow incident",
  function: {
    name: BuiltInToolNames.ServiceNowResolveIncident,
    description: "Resolve a ServiceNow incident.",
    parameters: {
      type: "object",
      required: ["incident_id", "resolution_code", "resolution_notes"],
      properties: {
        incident_id: { type: "string" },
        resolution_code: { type: "string" },
        resolution_notes: { type: "string" },
      },
    },
  },
};

export const servicenowListIncidentsTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: List Incidents",
  wouldLikeTo: "list ServiceNow incidents",
  isCurrently: "listing ServiceNow incidents",
  hasAlready: "listed ServiceNow incidents",
  function: {
    name: BuiltInToolNames.ServiceNowListIncidents,
    description: "List incidents from ServiceNow with optional filters.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
        state: { type: "string" },
        assigned_to: { type: "string" },
        category: { type: "string" },
        query: { type: "string" },
      },
    },
  },
};

export const servicenowGetIncidentTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: Get Incident",
  wouldLikeTo: "get incident {{{ incident_id }}}",
  isCurrently: "fetching a ServiceNow incident",
  hasAlready: "fetched a ServiceNow incident",
  function: {
    name: BuiltInToolNames.ServiceNowGetIncident,
    description:
      "Get an incident by number or sys_id from the ServiceNow incident table.",
    parameters: {
      type: "object",
      required: ["incident_id"],
      properties: {
        incident_id: { type: "string" },
        display_value: { type: "boolean" },
        exclude_reference_link: { type: "boolean" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export const servicenowListCatalogItemsTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: List Catalog Items",
  wouldLikeTo: "list ServiceNow catalog items",
  isCurrently: "listing ServiceNow catalog items",
  hasAlready: "listed ServiceNow catalog items",
  function: {
    name: BuiltInToolNames.ServiceNowListCatalogItems,
    description: "List service catalog items from ServiceNow.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
        category: { type: "string" },
        query: { type: "string" },
        active: { type: "boolean" },
      },
    },
  },
};

export const servicenowGetCatalogItemTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: Get Catalog Item",
  wouldLikeTo: "get catalog item {{{ item_id }}}",
  isCurrently: "fetching a ServiceNow catalog item",
  hasAlready: "fetched a ServiceNow catalog item",
  function: {
    name: BuiltInToolNames.ServiceNowGetCatalogItem,
    description: "Get a specific service catalog item from ServiceNow.",
    parameters: {
      type: "object",
      required: ["item_id"],
      properties: {
        item_id: { type: "string" },
      },
    },
  },
};

export const servicenowListCatalogCategoriesTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: List Catalog Categories",
  wouldLikeTo: "list ServiceNow catalog categories",
  isCurrently: "listing ServiceNow catalog categories",
  hasAlready: "listed ServiceNow catalog categories",
  function: {
    name: BuiltInToolNames.ServiceNowListCatalogCategories,
    description: "List service catalog categories from ServiceNow.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
        query: { type: "string" },
        active: { type: "boolean" },
      },
    },
  },
};

export const servicenowCreateCatalogCategoryTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Create Catalog Category",
  wouldLikeTo: "create a ServiceNow catalog category",
  isCurrently: "creating a ServiceNow catalog category",
  hasAlready: "created a ServiceNow catalog category",
  function: {
    name: BuiltInToolNames.ServiceNowCreateCatalogCategory,
    description: "Create a new service catalog category in ServiceNow.",
    parameters: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        parent: { type: "string" },
        icon: { type: "string" },
        active: { type: "boolean" },
        order: { type: "number" },
      },
    },
  },
};

export const servicenowUpdateCatalogCategoryTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Update Catalog Category",
  wouldLikeTo: "update catalog category {{{ category_id }}}",
  isCurrently: "updating a ServiceNow catalog category",
  hasAlready: "updated a ServiceNow catalog category",
  function: {
    name: BuiltInToolNames.ServiceNowUpdateCatalogCategory,
    description: "Update an existing service catalog category in ServiceNow.",
    parameters: {
      type: "object",
      required: ["category_id"],
      properties: {
        category_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        parent: { type: "string" },
        icon: { type: "string" },
        active: { type: "boolean" },
        order: { type: "number" },
      },
    },
  },
};

export const servicenowMoveCatalogItemsTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Move Catalog Items",
  wouldLikeTo: "move catalog items to category {{{ target_category_id }}}",
  isCurrently: "moving ServiceNow catalog items",
  hasAlready: "moved ServiceNow catalog items",
  function: {
    name: BuiltInToolNames.ServiceNowMoveCatalogItems,
    description: "Move catalog items between categories in ServiceNow.",
    parameters: {
      type: "object",
      required: ["item_ids", "target_category_id"],
      properties: {
        item_ids: { type: "array", items: { type: "string" } },
        target_category_id: { type: "string" },
      },
    },
  },
};

export const servicenowCreateCatalogItemVariableTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Create Catalog Item Variable",
  wouldLikeTo: "create a catalog item variable",
  isCurrently: "creating a ServiceNow catalog item variable",
  hasAlready: "created a ServiceNow catalog item variable",
  function: {
    name: BuiltInToolNames.ServiceNowCreateCatalogItemVariable,
    description: "Create a new variable (form field) for a catalog item.",
    parameters: {
      type: "object",
      required: ["catalog_item_id", "name", "type", "label"],
      properties: {
        catalog_item_id: { type: "string" },
        name: { type: "string" },
        type: { type: "string" },
        label: { type: "string" },
        mandatory: { type: "boolean" },
        help_text: { type: "string" },
        default_value: { type: "string" },
        description: { type: "string" },
        order: { type: "number" },
        reference_table: { type: "string" },
        reference_qualifier: { type: "string" },
        max_length: { type: "number" },
        min: { type: "number" },
        max: { type: "number" },
      },
    },
  },
};

export const servicenowListCatalogItemVariablesTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: List Catalog Item Variables",
  wouldLikeTo: "list catalog item variables for {{{ catalog_item_id }}}",
  isCurrently: "listing ServiceNow catalog item variables",
  hasAlready: "listed ServiceNow catalog item variables",
  function: {
    name: BuiltInToolNames.ServiceNowListCatalogItemVariables,
    description: "List variables for a service catalog item.",
    parameters: {
      type: "object",
      required: ["catalog_item_id"],
      properties: {
        catalog_item_id: { type: "string" },
        include_details: { type: "boolean" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
};

export const servicenowUpdateCatalogItemVariableTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Update Catalog Item Variable",
  wouldLikeTo: "update catalog item variable {{{ variable_id }}}",
  isCurrently: "updating a ServiceNow catalog item variable",
  hasAlready: "updated a ServiceNow catalog item variable",
  function: {
    name: BuiltInToolNames.ServiceNowUpdateCatalogItemVariable,
    description: "Update an existing catalog item variable.",
    parameters: {
      type: "object",
      required: ["variable_id"],
      properties: {
        variable_id: { type: "string" },
        label: { type: "string" },
        mandatory: { type: "boolean" },
        help_text: { type: "string" },
        default_value: { type: "string" },
        description: { type: "string" },
        order: { type: "number" },
        reference_qualifier: { type: "string" },
        max_length: { type: "number" },
        min: { type: "number" },
        max: { type: "number" },
      },
    },
  },
};

export const servicenowListCatalogsTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: List Catalogs",
  wouldLikeTo: "list ServiceNow catalogs",
  isCurrently: "listing ServiceNow catalogs",
  hasAlready: "listed ServiceNow catalogs",
  function: {
    name: BuiltInToolNames.ServiceNowListCatalogs,
    description: "List service catalogs from ServiceNow.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
        query: { type: "string" },
        active: { type: "boolean" },
      },
    },
  },
};

export const servicenowCreateChangeRequestTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Create Change Request",
  wouldLikeTo: "create a ServiceNow change request",
  isCurrently: "creating a ServiceNow change request",
  hasAlready: "created a ServiceNow change request",
  function: {
    name: BuiltInToolNames.ServiceNowCreateChangeRequest,
    description: "Create a new change request in ServiceNow.",
    parameters: {
      type: "object",
      required: ["short_description", "type"],
      properties: {
        short_description: { type: "string" },
        description: { type: "string" },
        type: { type: "string" },
        risk: { type: "string" },
        impact: { type: "string" },
        category: { type: "string" },
        requested_by: { type: "string" },
        assignment_group: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
      },
    },
  },
};

export const servicenowUpdateChangeRequestTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Update Change Request",
  wouldLikeTo: "update change request {{{ change_id }}}",
  isCurrently: "updating a ServiceNow change request",
  hasAlready: "updated a ServiceNow change request",
  function: {
    name: BuiltInToolNames.ServiceNowUpdateChangeRequest,
    description: "Update an existing change request in ServiceNow.",
    parameters: {
      type: "object",
      required: ["change_id"],
      properties: {
        change_id: { type: "string" },
        short_description: { type: "string" },
        description: { type: "string" },
        state: { type: "string" },
        risk: { type: "string" },
        impact: { type: "string" },
        category: { type: "string" },
        assignment_group: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        work_notes: { type: "string" },
      },
    },
  },
};

export const servicenowListChangeRequestsTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: List Change Requests",
  wouldLikeTo: "list ServiceNow change requests",
  isCurrently: "listing ServiceNow change requests",
  hasAlready: "listed ServiceNow change requests",
  function: {
    name: BuiltInToolNames.ServiceNowListChangeRequests,
    description: "List change requests from ServiceNow.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
        state: { type: "string" },
        type: { type: "string" },
        category: { type: "string" },
        assignment_group: { type: "string" },
        timeframe: { type: "string" },
        query: { type: "string" },
      },
    },
  },
};

export const servicenowGetChangeRequestDetailsTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: Get Change Request Details",
  wouldLikeTo: "get details for change request {{{ change_id }}}",
  isCurrently: "fetching a ServiceNow change request",
  hasAlready: "fetched a ServiceNow change request",
  function: {
    name: BuiltInToolNames.ServiceNowGetChangeRequestDetails,
    description: "Get detailed information about a specific change request.",
    parameters: {
      type: "object",
      required: ["change_id"],
      properties: {
        change_id: { type: "string" },
      },
    },
  },
};

export const servicenowAddChangeTaskTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Add Change Task",
  wouldLikeTo: "add a task to change request {{{ change_id }}}",
  isCurrently: "adding a ServiceNow change task",
  hasAlready: "added a ServiceNow change task",
  function: {
    name: BuiltInToolNames.ServiceNowAddChangeTask,
    description: "Add a task to a change request in ServiceNow.",
    parameters: {
      type: "object",
      required: ["change_id", "short_description"],
      properties: {
        change_id: { type: "string" },
        short_description: { type: "string" },
        description: { type: "string" },
        assigned_to: { type: "string" },
        planned_start_date: { type: "string" },
        planned_end_date: { type: "string" },
      },
    },
  },
};

export const servicenowSubmitChangeForApprovalTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Submit Change for Approval",
  wouldLikeTo: "submit change request {{{ change_id }}} for approval",
  isCurrently: "submitting a ServiceNow change for approval",
  hasAlready: "submitted a ServiceNow change for approval",
  function: {
    name: BuiltInToolNames.ServiceNowSubmitChangeForApproval,
    description: "Submit a change request for approval in ServiceNow.",
    parameters: {
      type: "object",
      required: ["change_id"],
      properties: {
        change_id: { type: "string" },
        approval_comments: { type: "string" },
      },
    },
  },
};

export const servicenowApproveChangeTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Approve Change",
  wouldLikeTo: "approve change request {{{ change_id }}}",
  isCurrently: "approving a ServiceNow change request",
  hasAlready: "approved a ServiceNow change request",
  function: {
    name: BuiltInToolNames.ServiceNowApproveChange,
    description: "Approve a change request in ServiceNow.",
    parameters: {
      type: "object",
      required: ["change_id"],
      properties: {
        change_id: { type: "string" },
        approver_id: { type: "string" },
        approval_comments: { type: "string" },
      },
    },
  },
};

export const servicenowRejectChangeTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Reject Change",
  wouldLikeTo: "reject change request {{{ change_id }}}",
  isCurrently: "rejecting a ServiceNow change request",
  hasAlready: "rejected a ServiceNow change request",
  function: {
    name: BuiltInToolNames.ServiceNowRejectChange,
    description: "Reject a change request in ServiceNow.",
    parameters: {
      type: "object",
      required: ["change_id", "rejection_reason"],
      properties: {
        change_id: { type: "string" },
        approver_id: { type: "string" },
        rejection_reason: { type: "string" },
      },
    },
  },
};

export const servicenowCreateTaskTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Create Task",
  wouldLikeTo: "create a ServiceNow task",
  isCurrently: "creating a ServiceNow task",
  hasAlready: "created a ServiceNow task",
  function: {
    name: BuiltInToolNames.ServiceNowCreateTask,
    description: "Create a new record in the ServiceNow task table.",
    parameters: {
      type: "object",
      required: ["fields"],
      properties: {
        fields: { type: "object" },
      },
    },
  },
};

export const servicenowUpdateTaskTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Update Task",
  wouldLikeTo: "update task {{{ task_id }}}",
  isCurrently: "updating a ServiceNow task",
  hasAlready: "updated a ServiceNow task",
  function: {
    name: BuiltInToolNames.ServiceNowUpdateTask,
    description: "Update an existing task by number or sys_id.",
    parameters: {
      type: "object",
      required: ["task_id", "fields"],
      properties: {
        task_id: { type: "string" },
        fields: { type: "object" },
      },
    },
  },
};

export const servicenowGetTaskTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: Get Task",
  wouldLikeTo: "get task {{{ task_id }}}",
  isCurrently: "fetching a ServiceNow task",
  hasAlready: "fetched a ServiceNow task",
  function: {
    name: BuiltInToolNames.ServiceNowGetTask,
    description: "Get a task by number or sys_id.",
    parameters: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: { type: "string" },
        display_value: { type: "boolean" },
        exclude_reference_link: { type: "boolean" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export const servicenowListTasksTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: List Tasks",
  wouldLikeTo: "list ServiceNow tasks",
  isCurrently: "listing ServiceNow tasks",
  hasAlready: "listed ServiceNow tasks",
  function: {
    name: BuiltInToolNames.ServiceNowListTasks,
    description: "List task records with optional filters.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
        query: { type: "string" },
        display_value: { type: "boolean" },
        exclude_reference_link: { type: "boolean" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export const servicenowCreateProblemTaskTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Create Problem Task",
  wouldLikeTo: "create a ServiceNow problem task",
  isCurrently: "creating a ServiceNow problem task",
  hasAlready: "created a ServiceNow problem task",
  function: {
    name: BuiltInToolNames.ServiceNowCreateProblemTask,
    description: "Create a new record in the ServiceNow problem_task table.",
    parameters: {
      type: "object",
      required: ["fields"],
      properties: {
        fields: { type: "object" },
      },
    },
  },
};

export const servicenowUpdateProblemTaskTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Update Problem Task",
  wouldLikeTo: "update problem task {{{ problem_task_id }}}",
  isCurrently: "updating a ServiceNow problem task",
  hasAlready: "updated a ServiceNow problem task",
  function: {
    name: BuiltInToolNames.ServiceNowUpdateProblemTask,
    description: "Update an existing problem task by number or sys_id.",
    parameters: {
      type: "object",
      required: ["problem_task_id", "fields"],
      properties: {
        problem_task_id: { type: "string" },
        fields: { type: "object" },
      },
    },
  },
};

export const servicenowGetProblemTaskTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: Get Problem Task",
  wouldLikeTo: "get problem task {{{ problem_task_id }}}",
  isCurrently: "fetching a ServiceNow problem task",
  hasAlready: "fetched a ServiceNow problem task",
  function: {
    name: BuiltInToolNames.ServiceNowGetProblemTask,
    description: "Get a problem task by number or sys_id.",
    parameters: {
      type: "object",
      required: ["problem_task_id"],
      properties: {
        problem_task_id: { type: "string" },
        display_value: { type: "boolean" },
        exclude_reference_link: { type: "boolean" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export const servicenowListProblemTasksTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: List Problem Tasks",
  wouldLikeTo: "list ServiceNow problem tasks",
  isCurrently: "listing ServiceNow problem tasks",
  hasAlready: "listed ServiceNow problem tasks",
  function: {
    name: BuiltInToolNames.ServiceNowListProblemTasks,
    description: "List problem tasks with optional filters.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
        query: { type: "string" },
        display_value: { type: "boolean" },
        exclude_reference_link: { type: "boolean" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export const servicenowCreateScTaskTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Create Catalog Task",
  wouldLikeTo: "create a ServiceNow catalog task",
  isCurrently: "creating a ServiceNow catalog task",
  hasAlready: "created a ServiceNow catalog task",
  function: {
    name: BuiltInToolNames.ServiceNowCreateScTask,
    description: "Create a new record in the ServiceNow sc_task table.",
    parameters: {
      type: "object",
      required: ["fields"],
      properties: {
        fields: { type: "object" },
      },
    },
  },
};

export const servicenowUpdateScTaskTool: Tool = {
  ...(serviceNowBase as any),
  displayTitle: "ServiceNow: Update Catalog Task",
  wouldLikeTo: "update catalog task {{{ sc_task_id }}}",
  isCurrently: "updating a ServiceNow catalog task",
  hasAlready: "updated a ServiceNow catalog task",
  function: {
    name: BuiltInToolNames.ServiceNowUpdateScTask,
    description: "Update an existing sc_task record by number or sys_id.",
    parameters: {
      type: "object",
      required: ["sc_task_id", "fields"],
      properties: {
        sc_task_id: { type: "string" },
        fields: { type: "object" },
      },
    },
  },
};

export const servicenowGetScTaskTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: Get Catalog Task",
  wouldLikeTo: "get catalog task {{{ sc_task_id }}}",
  isCurrently: "fetching a ServiceNow catalog task",
  hasAlready: "fetched a ServiceNow catalog task",
  function: {
    name: BuiltInToolNames.ServiceNowGetScTask,
    description: "Get a catalog task (sc_task) by number or sys_id.",
    parameters: {
      type: "object",
      required: ["sc_task_id"],
      properties: {
        sc_task_id: { type: "string" },
        display_value: { type: "boolean" },
        exclude_reference_link: { type: "boolean" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export const servicenowListScTasksTool: Tool = {
  ...(serviceNowReadOnlyBase as any),
  displayTitle: "ServiceNow: List Catalog Tasks",
  wouldLikeTo: "list ServiceNow catalog tasks",
  isCurrently: "listing ServiceNow catalog tasks",
  hasAlready: "listed ServiceNow catalog tasks",
  function: {
    name: BuiltInToolNames.ServiceNowListScTasks,
    description: "List sc_task records with optional filters.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
        query: { type: "string" },
        display_value: { type: "boolean" },
        exclude_reference_link: { type: "boolean" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
};
