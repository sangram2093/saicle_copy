const ENTITY_BASE_PROMPT = (summary: string) => `
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

export const ENTITY_PROMPT = (summary: string, previousGraph?: string) => {
  if (!previousGraph) return ENTITY_BASE_PROMPT(summary);
  return `${ENTITY_BASE_PROMPT(summary)}

Reference of the previous year's regulation summary and graph is given below. Use it only for semantic difference matching. Reuse existing structure, entities, and relationship patterns unless the regulation explicitly defines a new obligation.
${previousGraph}`;
};

export const DEFAULT_MAX_OUTPUT_TOKENS = parseInt(
  process.env.MAX_OUTPUT_TOKENS || "8192",
  10,
);

export function extractJsonBlob(rawText: string): any {
  const text = (rawText || "").trim();
  const attempts: string[] = [];

  const direct = tryJson(text);
  if (direct) return direct;

  const fenced = Array.from(
    text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gm),
  ).map((m) => m[1]);
  attempts.push(...fenced);

  if (!attempts.length) {
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
