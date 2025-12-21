import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const summarizePdfTool: Tool = {
  type: "function",
  displayTitle: "Summarize PDF",
  wouldLikeTo: "summarize a PDF with chunking for large files",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.SummarizePdf,
    description:
      "Extract text from a PDF, chunk it to stay under token limits, and summarize with the configured LLM.",
    parameters: {
      type: "object",
      required: ["pdfPath"],
      properties: {
        pdfPath: {
          type: "string",
          description:
            "Absolute or workspace-relative path to the PDF to summarize.",
        },
        chunkSizeChars: {
          type: "number",
          description:
            "Max characters per chunk before sending to the LLM (default 12000, or env AURA_PDF_CHUNK_SIZE_CHARS).",
        },
        maxOutputTokens: {
          type: "number",
          description:
            "Max tokens per LLM call (default MAX_OUTPUT_TOKENS env or 8192).",
        },
        model: {
          type: "string",
          description:
            "Model to use (defaults to the active/session model if omitted).",
        },
        includePerChunk: {
          type: "boolean",
          description:
            "If true, include per-chunk summaries in the output (in addition to the combined summary).",
          default: false,
        },
      },
    },
  },
};
