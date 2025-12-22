export const DEFAULT_MAX_OUTPUT_TOKENS = parseInt(
  process.env.MAX_OUTPUT_TOKENS || "8192",
  10,
);

export const DEFAULT_CHUNK_SIZE_CHARS = parseInt(
  process.env.AURA_PDF_CHUNK_SIZE_CHARS || "12000",
  10,
);

export const DEFAULT_MARKDOWN_PROMPT = `
You are an AI assistant extracting entities and relationships from regulatory text.

Output ONLY in the following markdown format (no JSON):

# Entities
- E1: Entity Name (type)
- E2: Another Entity (type)

# Relationships
- E1 --Verb--> E2 | cond: ... | opt: ... | freq: ...

Instructions:
- Use stable IDs (E1, E2, …) consistently.
- Do not repeat duplicate entities across chunks; reuse existing IDs when possible.
- Include verb/action, and when available include condition (cond), optionality (opt), and frequency (freq).
- No additional commentary; markdown only.`.trim();

export function parseGraphFromMarkdown(markdown: string): {
  entities: any[];
  relationships: any[];
} {
  const entities: any[] = [];
  const relationships: any[] = [];

  const lines = markdown.split(/\r?\n/);
  let section: "entities" | "relationships" | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^#\s*Entities/i.test(line)) {
      section = "entities";
      continue;
    }
    if (/^#\s*Relationships/i.test(line)) {
      section = "relationships";
      continue;
    }
    if (!line.startsWith("- ")) continue;

    if (section === "entities") {
      // Format: - E1: Name (type)
      const m = line.match(/^-+\s*([A-Za-z0-9_-]+)\s*:\s*(.+?)(?:\s*\((.+)\))?$/);
      if (m) {
        entities.push({
          id: m[1],
          name: m[2].trim(),
          type: (m[3] || "process").trim(),
        });
      }
    } else if (section === "relationships") {
      // Format: - E1 --verb--> E2 | cond: ... | opt: ... | freq: ...
      const relMatch = line.match(
        /^-\s*([A-Za-z0-9_-]+)\s*--(.+?)-->\s*([A-Za-z0-9_-]+)(.*)?$/i,
      );
      if (relMatch) {
        const extras = relMatch[4] || "";
        const cond = matchAttr(extras, /cond:\s*([^|]+)/i);
        const opt = matchAttr(extras, /opt:\s*([^|]+)/i);
        const freq = matchAttr(extras, /freq:\s*([^|]+)/i);
        relationships.push({
          subject_id: relMatch[1],
          object_id: relMatch[3],
          verb: relMatch[2].trim(),
          "Condition for Relationship to be Active": cond || "",
          Optionality: opt || "",
          frequency: freq || "",
        });
      }
    }
  }

  return { entities, relationships };
}

function matchAttr(text: string, regex: RegExp): string | undefined {
  const m = text.match(regex);
  return m ? m[1].trim() : undefined;
}

export function mergeGraphs(
  base: any,
  incoming: any,
): { entities: any[]; relationships: any[] } {
  const baseEntities = base?.entities || [];
  const baseRels = base?.relationships || [];
  const incomingEntities = incoming?.entities || [];
  const incomingRels = incoming?.relationships || [];

  const entityKey = (e: any) =>
    `${(e.name || "").trim().toLowerCase()}|${(e.type || "process").toLowerCase()}`;
  const relKey = (r: any) =>
    [
      r.subject_id,
      r.object_id,
      (r.verb || "").trim().toLowerCase(),
      (r["Condition for Relationship to be Active"] || "").trim().toLowerCase(),
      (r.frequency || "").trim().toLowerCase(),
    ].join("|");

  const entityMap = new Map<string, any>();
  baseEntities.forEach((e: any) => entityMap.set(entityKey(e), e));
  incomingEntities.forEach((e: any) => {
    const key = entityKey(e);
    if (!entityMap.has(key)) {
      entityMap.set(key, e);
    }
  });

  const relMap = new Map<string, any>();
  baseRels.forEach((r: any) => relMap.set(relKey(r), r));
  incomingRels.forEach((r: any) => {
    const key = relKey(r);
    if (!relMap.has(key)) {
      relMap.set(key, r);
    }
  });

  return {
    entities: Array.from(entityMap.values()),
    relationships: Array.from(relMap.values()),
  };
}

export function toMarkdown(graph: { entities: any[]; relationships: any[] }): string {
  const entitiesMd = (graph.entities || [])
    .map(
      (e) =>
        `- ${e.id || "(id)"}: ${e.name || "(name)"} (${e.type || "process"})`,
    )
    .join("\n");

  const relsMd = (graph.relationships || [])
    .map((r) => {
      const cond = r["Condition for Relationship to be Active"] || "";
      const opt = r["Optionality"] || "";
      const freq = r["frequency"] || "";
      const parts = [
        `${r.subject_id} --${r.verb || "(verb)"}--> ${r.object_id}`,
        cond ? `cond: ${cond}` : "",
        opt ? `opt: ${opt}` : "",
        freq ? `freq: ${freq}` : "",
      ].filter(Boolean);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");

  return [
    "# Entities",
    entitiesMd || "(none)",
    "",
    "# Relationships",
    relsMd || "(none)",
  ].join("\n");
}
