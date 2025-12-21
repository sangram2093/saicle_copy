import { ILLM } from "../..";

export const DEFAULT_CHUNK_SIZE_CHARS = parseInt(
  process.env.AURA_PDF_CHUNK_SIZE_CHARS || "12000",
  10,
);

export const DEFAULT_MAX_OUTPUT_TOKENS = parseInt(
  process.env.MAX_OUTPUT_TOKENS || "8192",
  10,
);

export const SUMMARY_PROMPT = (text: string, context?: string) => {
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

  if (!context) return base;
  return `${base}

Reference of the past year regulation entity relationship is given for your reference below. Use it only for semantic difference matching. Make sure you figure out the differences very clear in the above text and previous year's summarized text and provide the summary for this year based on above text.

${context}`;
};

export function chunkText(text: string, maxChars: number): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  return chunks;
}

// Wrapper to keep a single place for completions
export async function runCompletion(
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
