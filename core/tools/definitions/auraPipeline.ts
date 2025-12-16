import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

const DESCRIPTION = `Run an end-to-end Aura pipeline on regulation PDFs:
- Read a new PDF (and optional old PDF) and produce detailed summaries using Vertex AI/Gemini prompts.
- Extract entities/relationships from the summaries.
- Build PlantUML graphs for the new doc and, when an old doc is provided, a color-coded diff graph.`;

export const auraPipelineTool: Tool = {
  type: "function",
  displayTitle: "Aura pipeline",
  wouldLikeTo: "run the Aura PDF → summary → graph pipeline",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.AuraPipeline,
    description: DESCRIPTION,
    parameters: {
      type: "object",
      required: ["newPdfPath"],
      properties: {
        newPdfPath: {
          type: "string",
          description: "Absolute or workspace-relative path to the new PDF to analyze.",
        },
        oldPdfPath: {
          type: "string",
          description: "Optional path to the previous-year PDF for comparison.",
        },
        model: {
          type: "string",
          description: "Gemini/Vertex model to use (defaults to env GEMINI_MODEL or gemini-1.5-flash).",
        },
        projectId: {
          type: "string",
          description: "GCP project ID (defaults to PROJECT_ID/PROJECT_NAME env).",
        },
        location: {
          type: "string",
          description: "Vertex AI region (defaults to LOCATION env or us-central1).",
        },
        maxOutputTokens: {
          type: "number",
          description: "Max tokens for each LLM call (default 8192).",
        },
        plantumlScale: {
          type: "string",
          description: "PlantUML scale directive, e.g., 'max 1600*900' or '1.2'.",
        },
      },
    },
  },
};
