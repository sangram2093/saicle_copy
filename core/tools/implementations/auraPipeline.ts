import fs from "fs";
import path from "path";
// @ts-ignore pdf-parse ships without bundled types
import pdfParse from "pdf-parse";

import { ToolImpl } from ".";
import { ContextItem, ILLM } from "../..";
import { BuiltInToolNames } from "../builtIn";
import { getOptionalStringArg, getStringArg } from "../parseArgs";

type AuraPipelineArgs = {
  newPdfPath: string;
  oldPdfPath?: string;
  model?: string;
  projectId?: string;
  location?: string;
  maxOutputTokens?: number;
  plantumlScale?: string;
};

type EntityGraph = {
  entities?: Array<{ id: string; name: string; type?: string }>;
  relationships?: Array<{
    subject_id: string;
    subject_name?: string;
    verb?: string;
    object_id: string;
    object_name?: string;
    Optionality?: string;
    "Condition for Relationship to be Active"?: string;
    frequency?: string;
  }>;
};

type CanonicalGraph = {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{
    source: string;
    target: string;
    relation: string;
    condition: string;
    optionality: string;
    frequency: string;
  }>;
};

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const DEFAULT_LOCATION = process.env.LOCATION || "us-central1";
const DEFAULT_PROJECT =
  process.env.PROJECT_ID || process.env.PROJECT_NAME || "project";
const DEFAULT_MAX_OUTPUT_TOKENS = parseInt(
  process.env.MAX_OUTPUT_TOKENS || "8192",
  10,
);
const DEFAULT_PUML_SCALE = process.env.PLANTUML_SCALE || "max 1600*900";

const SUMMARY_PROMPT = (text: string, context?: string) => {
  const base = `
You are an AI assistant specialized in analyzing financial regulation documents to produce accurate, consistent, and structured summaries.

Your task is to extract and explain the key operational, compliance, and reporting requirements, especially highlighting changes between previous and current regulatory expectations - including reporting methods, data fields, and submission timelines.

Resolve any internal references and use only the content provided.

Format the response with this structure:

---

**Regulation Summary:**

1. **Purpose and Objective:**
State the regulatory intent - especially changes in reporting infrastructure and traceability.

2. **Scope and Applicability:**
List impacted entities, transaction types (e.g., OTC positions), and applicable metals or instruments.

3. **Definitions and Eligibility:**
Clarify critical terms like Settlement Type, LEI usage, Short Code, etc.

4. **Reporting Requirements:**
Compare new vs. old requirements: deadlines, submission channels (email vs. UDG), file types, validation steps.

5. **Inclusion and Exclusion Criteria:**
Detail positions to be included (e.g., all OTC positions, no threshold), and treatment of anonymous or non-LEI holders.

6. **Data Rules and Validation Logic:**
Describe XML structure, required fields (e.g., SeqNo, Report Reference), validation rules (e.g., OTC-008).

7. **Operational Notes and Exceptions:**
Mention nil reporting, dual submissions during parallel run, and third-party communication responsibilities.

---

**Regulation Document:**
${text}
`.trim();

  if (!context) {
    return base;
  }

  return `${base}

Reference of the past year regulation entity relationship is given for your reference below. Use it only for semantic difference matching. Make sure you figure out the differences very clear in the above text and previous year's summarized text and provide the summary for this year based on above text.

${context}`;
};

const ENTITY_PROMPT = (summary: string, context?: string) => {
  const base = `
You are an AI assistant specialized in extracting structured semantic relationships from financial regulation summaries.

Your task is to extract subject-verb-object relationships focused on weekly OTC position reporting by Members to LME, with key conditional and validation rules.

For the given summary of the regulation, provide entity relationships in subject-verb-object, optionality, condition for relationship to be active, property of the object which is part of the condition, the frequency of condition validation and the actual thresholds where XYZ bank is licensed commercial bank. Consider the essential elements of an obligation such as active subject (creditor or obligee), passive subject (debtor or obligor) and prestation (object or subject matter of the obligation) and write the relationships in the above format with the perspective of XYZ bank as an obligor where the relationships will be useful for creating the standard operating procedures for the bank.
The verb should correspond to obligation and the conditions which make the obligation mandatory should be reported as conditions. For e.g. XYZ bank grants a loan to any customer has no meaning from the obligation perspective but a granting of a loan is a condition which obligates XYZ bank to report the loan and associated attributes.
You as an assistant should resolve all of the cross references within the document. Assign each entity a globally unique ID.

?? **Instructions**:

- IGNORE isolated nodes and ONLY extract entities that participate in at least one relationship and are connected to root node
- Avoid listing entities that are not connected to any verb-object pair
- Merge similar entities (e.g., all LCBs as one node)
- For each relationship, include:
    - Subject ID & Name
    - Verb (action)
    - Object ID & Name
    - Optionality
    - Condition for relationship to be active
    - Property of object used in the condition
    - Thresholds involved
    - Reporting frequency
    
### Format:
Respond in **valid JSON only** using the structure below. Do not explain or include any additional commentary.

\`\`\`json
{
    "entities": [
        {"id": "E1", "name": "XYZ Bank (LCB)", "type": "organization"}
    ],
    "relationships": [
        {
            "subject_id": "E1",
            "subject_name": "XYZ Bank (LCB)",
            "verb": "Reports",
            "object_id": "E2",
            "object_name": "Loan (to Prime Customer)",
            "Optionality": "Conditional (Only if eligible loans exist)",
            "Condition for Relationship to be Active": "...",
            "Property of Object (part of condition)": "...",
            "Thresholds": "...",
            "frequency": "to be validated quarterly"
        }
    ]
}

-- 

**Regulation Document:**:
${summary}
`.trim();

  if (!context) {
    return base;
  }

  return `${base}

Reference of the previous year's regulation summary and graph is given below. Use it only for semantic difference matching. Reuse existing structure, entities, and relationship patterns unless the regulation explicitly defines a new obligation.
${context}`;
};

function ensureFileExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

async function extractPdfText(pdfPath: string): Promise<string> {
  ensureFileExists(pdfPath);
  const data = await fs.promises.readFile(pdfPath);
  const parsed = await pdfParse(data);
  return (parsed as any)?.text || "";
}

async function runCompletion(
  llm: ILLM,
  prompt: string,
  model: string,
  maxOutputTokens: number,
): Promise<string> {
  const controller = new AbortController();
  return llm.complete(prompt, controller.signal, {
    model,
    maxTokens: maxOutputTokens,
    temperature: 0.01,
    topP: 0.1,
    topK: 40,
  });
}

function extractJsonBlob(raw: string): any {
  const text = (raw || "").trim();
  const attempts: string[] = [];

  const direct = tryJson(text);
  if (direct) return direct;

  const fenced = Array.from(
    text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gm),
  ).map((m) => m[1]);
  attempts.push(...fenced);

  if (!attempts.length) {
    // try brace scanning
    const start = text.indexOf("{");
    if (start !== -1) {
      let depth = 0;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (ch === "{") depth++;
        if (ch === "}") depth--;
        if (depth === 0) {
          attempts.push(text.slice(start, i + 1));
          break;
        }
      }
    }
  }

  for (const candidate of attempts) {
    const parsed = tryJson(candidate);
    if (parsed) return parsed;
  }

  throw new Error("No valid JSON object found in LLM response");
}

function tryJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toCanonicalGraph(graph: EntityGraph): CanonicalGraph {
  const nodes =
    graph.entities?.map((entity) => ({
      id: entity.id,
      label: entity.name || entity.id,
      type: entity.type || "process",
    })) ?? [];

  const edges =
    graph.relationships?.map((rel) => ({
      source: rel.subject_id,
      target: rel.object_id,
      relation: rel.verb || "",
      condition: rel["Condition for Relationship to be Active"] || "",
      optionality: rel.Optionality || "",
      frequency: rel.frequency || "",
    })) ?? [];

  return { nodes, edges };
}

function sanitizeId(raw: string) {
  return (raw || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function generatePlantUml(
  graph: CanonicalGraph,
  title?: string,
  scale?: string,
): string {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const lines: string[] = ["@startuml"];

  if (title) lines.push(`title ${title}`);
  if (scale) lines.push(`scale ${scale}`);

  lines.push("skinparam backgroundColor #FFFFFF");
  lines.push("skinparam componentStyle rectangle");
  lines.push("skinparam ArrowColor #555555");
  lines.push("skinparam ArrowThickness 1");

  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);
    const label = node.label || node.id;
    const type = (node.type || "process").toLowerCase();

    if (["actor", "party", "role", "person"].includes(type)) {
      lines.push(`actor "${label}" as ${nodeId}`);
    } else if (["system", "application", "repo", "trade_repository"].includes(type)) {
      lines.push(`node "${label}" as ${nodeId}`);
    } else {
      lines.push(`component "${label}" as ${nodeId}`);
    }
  }

  lines.push("");

  const detailLines: string[] = [];

  edges.forEach((edge, idx) => {
    const src = sanitizeId(edge.source);
    const dst = sanitizeId(edge.target);
    const relation = edge.relation || "";
    const edgeId = `E${idx + 1}`;
    lines.push(`${src} --> ${dst} : [${edgeId}] ${relation || "(edge)"}`);

    const detailParts = [];
    if (edge.condition) detailParts.push(`cond=${edge.condition}`);
    if (edge.optionality) detailParts.push(`opt=${edge.optionality}`);
    if (edge.frequency) detailParts.push(`freq=${edge.frequency}`);
    if (detailParts.length) {
      detailLines.push(
        `${edgeId}: ${edge.source} -> ${edge.target} | ${relation || "(edge)"} | ${detailParts.join("; ")}`,
      );
    }
  });

  if (detailLines.length) {
    lines.push("legend bottom");
    lines.push("  Edge details (use edge ID to match arrow):");
    detailLines.forEach((dl) => lines.push(`  ${dl}`));
    lines.push("endlegend");
  }

  lines.push("@enduml");
  return lines.join("\n");
}

function generatePlantUmlDiff(
  oldGraph: CanonicalGraph,
  newGraph: CanonicalGraph,
  title?: string,
  scale?: string,
): string {
  const edgeKey = (e: CanonicalGraph["edges"][number]) =>
    [
      e.source,
      e.target,
      e.relation || "",
      e.condition || "",
      e.optionality || "",
      e.frequency || "",
    ].join("|");

  const oldEdges = new Map(
    (oldGraph.edges || []).map((e) => [edgeKey(e), e]),
  );
  const newEdges = new Map(
    (newGraph.edges || []).map((e) => [edgeKey(e), e]),
  );

  const commonKeys = [...newEdges.keys()].filter((k) => oldEdges.has(k));
  const addedKeys = [...newEdges.keys()].filter((k) => !oldEdges.has(k));
  const removedKeys = [...oldEdges.keys()].filter((k) => !newEdges.has(k));

  const nodesById: Record<string, CanonicalGraph["nodes"][number]> = {};
  for (const n of [...(oldGraph.nodes || []), ...(newGraph.nodes || [])]) {
    nodesById[n.id] = n;
  }

  const lines: string[] = ["@startuml"];
  if (title) lines.push(`title ${title}`);
  if (scale) lines.push(`scale ${scale}`);
  lines.push("skinparam backgroundColor #FFFFFF");
  lines.push("skinparam componentStyle rectangle");
  lines.push("legend top");
  lines.push("  <color:#555555>Common</color>");
  lines.push("  <color:#008800>New</color>");
  lines.push("  <color:#BB0000>Removed</color>");
  lines.push("endlegend");

  Object.values(nodesById).forEach((node) => {
    const nodeId = sanitizeId(node.id);
    const label = node.label || node.id;
    const type = (node.type || "process").toLowerCase();
    if (["actor", "party", "role", "person"].includes(type)) {
      lines.push(`actor "${label}" as ${nodeId}`);
    } else if (["system", "application", "repo", "trade_repository"].includes(type)) {
      lines.push(`node "${label}" as ${nodeId}`);
    } else {
      lines.push(`component "${label}" as ${nodeId}`);
    }
  });

  lines.push("");
  const detailLines: string[] = [];
  let cid = 1;
  let nid = 1;
  let rid = 1;

  for (const key of commonKeys) {
    const edge = newEdges.get(key)!;
    const edgeId = `C${cid++}`;
    lines.push(edgeLine(edge, edgeId));
    detailLines.push(...edgeDetails(edge, edgeId));
  }

  for (const key of addedKeys) {
    const edge = newEdges.get(key)!;
    const edgeId = `N${nid++}`;
    lines.push(edgeLine(edge, edgeId, "#008800"));
    detailLines.push(...edgeDetails(edge, edgeId));
  }

  for (const key of removedKeys) {
    const edge = oldEdges.get(key)!;
    const edgeId = `R${rid++}`;
    lines.push(edgeLine(edge, edgeId, "#BB0000", true, "REMOVED:"));
    detailLines.push(...edgeDetails(edge, edgeId));
  }

  if (detailLines.length) {
    lines.push("legend bottom");
    lines.push("  Edge details (match IDs on arrows):");
    detailLines.forEach((dl) => lines.push(`  ${dl}`));
    lines.push("endlegend");
  }

  lines.push("@enduml");
  return lines.join("\n");
}

function edgeLine(
  edge: CanonicalGraph["edges"][number],
  edgeId?: string,
  color?: string,
  dashed = false,
  prefix = "",
): string {
  const src = sanitizeId(edge.source);
  const dst = sanitizeId(edge.target);
  const relation = edge.relation || "";

  let arrow = dashed ? "..>" : "-->";
  if (color) {
    arrow = `-[${color}]${arrow.substring(1)}`;
  }

  const labelParts = [prefix, edgeId ? `[${edgeId}]` : "", relation].filter(
    Boolean,
  );
  const label = labelParts.join(" ").trim();

  return label ? `${src} ${arrow} ${dst} : ${label}` : `${src} ${arrow} ${dst}`;
}

function edgeDetails(
  edge: CanonicalGraph["edges"][number],
  prefix?: string,
): string[] {
  const relation = edge.relation || "(unlabeled)";
  const detail = [];
  if (edge.condition) detail.push(`cond=${edge.condition}`);
  if (edge.optionality) detail.push(`opt=${edge.optionality}`);
  if (edge.frequency) detail.push(`freq=${edge.frequency}`);
  if (!detail.length) return [];
  const tag = prefix ? `${prefix}: ` : "";
  return [
    `${tag}${edge.source} -> ${edge.target} | ${relation} | ${detail.join("; ")}`,
  ];
}

function formatJson(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return `${obj}`;
  }
}

function getNumberArgOptional(args: any, key: string): number | undefined {
  if (typeof args?.[key] === "undefined") {
    return undefined;
  }
  const val = args[key];
  if (typeof val === "number") return val;
  if (typeof val === "string" && val.trim().length) {
    const parsed = Number(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  throw new Error(`Argument \`${key}\` must be a number if provided`);
}

export const auraPipelineImpl: ToolImpl = async (
  rawArgs: AuraPipelineArgs,
  extras,
) => {
  const newPdfPath = path.resolve(getStringArg(rawArgs, "newPdfPath"));
  const oldPdfPath = getOptionalStringArg(rawArgs, "oldPdfPath");
  const model = getOptionalStringArg(rawArgs, "model") || DEFAULT_MODEL;
  const location = getOptionalStringArg(rawArgs, "location") || DEFAULT_LOCATION;
  const projectId =
    getOptionalStringArg(rawArgs, "projectId") || DEFAULT_PROJECT;
  const maxTokens =
    getNumberArgOptional(rawArgs, "maxOutputTokens") ||
    DEFAULT_MAX_OUTPUT_TOKENS;
  const plantumlScale =
    getOptionalStringArg(rawArgs, "plantumlScale") || DEFAULT_PUML_SCALE;

  const [newText, oldText] = await Promise.all([
    extractPdfText(newPdfPath),
    oldPdfPath ? extractPdfText(path.resolve(oldPdfPath)) : Promise.resolve(""),
  ]);

  const oldSummary = oldText
    ? await runCompletion(
        extras.llm,
        SUMMARY_PROMPT(oldText),
        model,
        maxTokens,
      )
    : undefined;

  const newSummary = await runCompletion(
    extras.llm,
    SUMMARY_PROMPT(newText, oldSummary),
    model,
    maxTokens,
  );

  const oldEntities = oldSummary
    ? extractJsonBlob(
        await runCompletion(
          extras.llm,
          ENTITY_PROMPT(oldSummary),
          model,
          maxTokens,
        ),
      )
    : undefined;

  const newEntities = extractJsonBlob(
    await runCompletion(
      extras.llm,
      ENTITY_PROMPT(newSummary, oldEntities ? JSON.stringify(oldEntities) : ""),
      model,
      maxTokens,
    ),
  ) as EntityGraph;

  const newCanonical = toCanonicalGraph(newEntities);
  const oldCanonical = oldEntities ? toCanonicalGraph(oldEntities) : undefined;

  const plantumlNew = generatePlantUml(
    newCanonical,
    path.basename(newPdfPath),
    plantumlScale,
  );
  const plantumlOld =
    oldCanonical &&
    generatePlantUml(
      oldCanonical,
      path.basename(oldPdfPath || "old.pdf"),
      plantumlScale,
    );
  const plantumlDiff =
    oldCanonical &&
    generatePlantUmlDiff(
      oldCanonical,
      newCanonical,
      `${path.basename(newPdfPath)} (Diff)`,
      plantumlScale,
    );

  const contextItems: ContextItem[] = [
    {
      name: "Aura pipeline",
      description: "PDF → summary → entity graph → PlantUML",
      content: [
        `Tool: ${BuiltInToolNames.AuraPipeline}`,
        `Model: ${model}`,
        `Project: ${projectId}`,
        `Location: ${location}`,
        `New PDF: ${newPdfPath}`,
        oldPdfPath ? `Old PDF: ${path.resolve(oldPdfPath)}` : undefined,
        `Max tokens: ${maxTokens}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      name: "New summary",
      description: "Summary of new PDF",
      content: newSummary,
    },
    {
      name: "New entities",
      description: "Entity/relationship JSON extracted from new summary",
      content: `\`\`\`json\n${formatJson(newEntities)}\n\`\`\``,
    },
    {
      name: "PlantUML (new)",
      description: "Graph for new PDF",
      content: `\`\`\`plantuml\n${plantumlNew}\n\`\`\``,
    },
  ];

  if (oldSummary) {
    contextItems.splice(1, 0, {
      name: "Old summary",
      description: "Summary of old PDF",
      content: oldSummary,
    });
  }
  if (oldEntities) {
    contextItems.push({
      name: "Old entities",
      description: "Entity/relationship JSON extracted from old summary",
      content: `\`\`\`json\n${formatJson(oldEntities)}\n\`\`\``,
    });
  }
  if (plantumlOld) {
    contextItems.push({
      name: "PlantUML (old)",
      description: "Graph for old PDF",
      content: `\`\`\`plantuml\n${plantumlOld}\n\`\`\``,
    });
  }
  if (plantumlDiff) {
    contextItems.push({
      name: "PlantUML (diff)",
      description: "Diff graph (common gray, new green, removed red)",
      content: `\`\`\`plantuml\n${plantumlDiff}\n\`\`\``,
    });
  }

  return contextItems;
};
