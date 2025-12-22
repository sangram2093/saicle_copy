import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { ContextItem, ILLM } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getNumberArg, getOptionalStringArg, getStringArg } from "../parseArgs";
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_CHUNK_SIZE_CHARS,
  DEFAULT_MARKDOWN_PROMPT,
  parseGraphFromMarkdown,
  mergeGraphs,
  toMarkdown,
} from "./extractEntitiesHelpers";
import { chunkText } from "./parsePdfHelpers";
import { resolveRelativePathInDir } from "../../util/ideUtils";

type ExtractEntitiesArgs = {
  markdown: string;
  prompt?: string;
  promptFilePath?: string;
  previousGraphMarkdown?: string;
  model?: string;
  maxOutputTokens?: number;
  chunkSizeChars?: number;
};

export const extractEntitiesImpl: ToolImpl = async (
  args: ExtractEntitiesArgs,
  extras,
) => {
  const markdown = getStringArg(args, "markdown");
  const promptInline = getOptionalStringArg(args, "prompt");
  const promptFile = getOptionalStringArg(args, "promptFilePath");
  const previousGraphMarkdown = getOptionalStringArg(
    args,
    "previousGraphMarkdown",
  );
  const model = getOptionalStringArg(args, "model") || extras.llm.model;
  const maxTokens =
    typeof args.maxOutputTokens !== "undefined"
      ? Number(args.maxOutputTokens)
      : DEFAULT_MAX_OUTPUT_TOKENS;
  const chunkSize =
    typeof args.chunkSizeChars !== "undefined"
      ? getNumberArg(args as any, "chunkSizeChars")
      : DEFAULT_CHUNK_SIZE_CHARS;

  const basePrompt = await resolvePrompt(promptInline, promptFile, extras.ide);

  // Split markdown into chunks based on "## Chunk" headings; fallback to re-chunking plain text.
  const chunks = extractChunksFromMarkdown(markdown, chunkSize);
  if (!chunks.length) {
    throw new Error("No chunks found in markdown input.");
  }

  let aggregated =
    previousGraphMarkdown && previousGraphMarkdown.trim()
      ? parseGraphFromMarkdown(previousGraphMarkdown)
      : { entities: [], relationships: [] };

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    const prompt = buildPrompt(basePrompt, chunk, aggregated);
    const raw = await runCompletion(extras.llm, prompt, model, maxTokens);
    const chunkGraph = parseGraphFromMarkdown(raw);
    aggregated = mergeGraphs(aggregated, chunkGraph);
  }

  const contextItems: ContextItem[] = [
    {
      name: "Entities (markdown)",
      description: "Entity/relationship markdown extracted from chunks",
      content: toMarkdown(aggregated),
    },
  ];

  return contextItems;
};

async function resolvePrompt(promptInline: string | undefined, promptFile: string | undefined, ide: any) {
  if (promptInline && promptInline.trim().length > 0) {
    return promptInline;
  }
  if (promptFile) {
    const resolvedUri = await resolveRelativePathInDir(promptFile, ide);
    const resolvedPath =
      resolvedUri && resolvedUri.startsWith("file:")
        ? fileURLToPath(resolvedUri)
        : path.resolve(promptFile);
    return fs.readFileSync(resolvedPath, "utf-8");
  }
  // Default prompt (markdown-only)
  return DEFAULT_MARKDOWN_PROMPT;
}

function buildPrompt(basePrompt: string, chunk: string, previousGraph: any): string {
  const prev = previousGraph ? toMarkdown(previousGraph) : "";
  return `${basePrompt}

=== CHUNK ===
${chunk}

${prev ? `=== PREVIOUS GRAPH (MARKDOWN) ===\n${prev}` : ""}`;
}

function extractChunksFromMarkdown(markdown: string, fallbackChunkSize: number): string[] {
  const lines = markdown.split(/\r?\n/);
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^##\s+Chunk\s+\d+/i.test(line)) {
      if (current.length) {
        chunks.push(current.join("\n").trim());
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length) {
    chunks.push(current.join("\n").trim());
  }

  const cleaned = chunks.filter((c) => c.trim().length > 0);
  if (cleaned.length) return cleaned;

  // fallback: chunk raw text if no headings found
  return chunkText(markdown, fallbackChunkSize);
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
