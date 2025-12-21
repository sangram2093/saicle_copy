import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { ContextItem, ILLM } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getBooleanArg, getNumberArg, getOptionalStringArg, getStringArg } from "../parseArgs";
import { resolveRelativePathInDir } from "../../util/ideUtils";
import { runCompletion } from "./summarizePdfHelpers";
import { SUMMARY_PROMPT, chunkText, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_CHUNK_SIZE_CHARS } from "./summarizePdfHelpers";

type SummarizePdfArgs = {
  pdfPath: string;
  chunkSizeChars?: number;
  maxOutputTokens?: number;
  model?: string;
  includePerChunk?: boolean;
};

export const summarizePdfImpl: ToolImpl = async (args: SummarizePdfArgs, extras) => {
  const requestedPath = getStringArg(args, "pdfPath");
  const resolvedUri = await resolveRelativePathInDir(requestedPath, extras.ide);
  if (!resolvedUri) {
    throw new Error(`PDF not found: ${requestedPath}`);
  }

  const pdfPath =
    resolvedUri.startsWith("file://") || resolvedUri.startsWith("file:")
      ? fileURLToPath(resolvedUri)
      : path.resolve(requestedPath);

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  const chunkSize =
    typeof args.chunkSizeChars !== "undefined"
      ? getNumberArg(args as any, "chunkSizeChars")
      : DEFAULT_CHUNK_SIZE_CHARS;
  const maxTokens =
    typeof args.maxOutputTokens !== "undefined"
      ? getNumberArg(args as any, "maxOutputTokens")
      : DEFAULT_MAX_OUTPUT_TOKENS;
  const model = getOptionalStringArg(args, "model") || extras.llm.model;
  const includePerChunk =
    typeof args.includePerChunk !== "undefined"
      ? getBooleanArg(args as any, "includePerChunk", false) ?? false
      : false;

  // Lazy require the library module (not the package entry, which self-tests).
  // @ts-ignore pdf-parse has no bundled types
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const buffer = await fs.promises.readFile(pdfPath);
  const parsed = await pdfParse(buffer);
  const text = (parsed as any)?.text || "";

  const chunks = chunkText(text, chunkSize);
  if (chunks.length === 0) {
    throw new Error("No text found in PDF.");
  }

  const summaries: string[] = [];
  const perChunk: { chunkIndex: number; text: string; summary: string }[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    const summary = await runCompletion(
      extras.llm,
      SUMMARY_PROMPT(chunk),
      model,
      maxTokens,
    );
    summaries.push(summary);
    perChunk.push({ chunkIndex: idx + 1, text: chunk, summary });
  }

  const combined = summaries.join("\n\n");

  const contextItems: ContextItem[] = [
    {
      name: "PDF Summary",
      description: `Summarized ${path.basename(pdfPath)} (${chunks.length} chunk${chunks.length > 1 ? "s" : ""})`,
      content: combined,
    },
  ];

  if (includePerChunk) {
    contextItems.push({
      name: "Per-chunk summaries",
      description: "Chunked summaries",
      content: JSON.stringify(perChunk, null, 2),
    });
  }

  return contextItems;
};
