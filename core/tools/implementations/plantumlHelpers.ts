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

export function toCanonicalGraph(graph: EntityGraph): CanonicalGraph {
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

export function generatePlantuml(
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

export function generatePlantumlDiff(
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

  const labelParts = [prefix, edgeId ? `[${edgeId}]` : "", relation].filter(Boolean);
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
