import { DiffLine, ILLM } from "../..";
import { myersDiff } from "../../diff/myers";
import { generateLines } from "../../diff/util";
import { supportedLanguages } from "../../util/treeSitter";
import { getUriFileExtension } from "../../util/uri";
import { deterministicApplyLazyEdit } from "./deterministic";
import { streamLazyApply } from "./streamLazyApply";
import { applyUnifiedDiff, isUnifiedDiffFormat } from "./unifiedDiffApply";

function canUseInstantApply(filename: string) {
  const fileExtension = getUriFileExtension(filename);
  return supportedLanguages[fileExtension] !== undefined;
}

// simple heuristic placeholder detection (mirrors logic in streamLazyApply but lightweight)
function isPlaceHolderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.includes("UNCHANGED_CODE")) return true;
  // common variants LLM may emit
  return /\.\.\.\s*(existing code|rest of code|omitted|omitted section|snip|snippet)\s*\.\.\./i.test(
    trimmed,
  );
}

//remove placeholder marker lines that may have been introduced by the model but
// should not peersis in the final files (e.g. XML or config files).
function stripEphemeralPlaceHolders(content: string, original: string): string {
  const origHasPlaceHolder =
    /\.\.\.\s*(existing code|rest of code|omitted|omitted section|snip|snippet)\s*\.\.\./i.test(
      original,
    );
  if (origHasPlaceHolder) return content;
  const lines = content.split("\r?\n");
  const filtered = lines.filter((line) => !isPlaceHolderLine(line));
  return filtered.join("\n");
}

// Attempt to patch a partial snippet surrounded by placeholder lines for unsupported languages
// Pattern expected
// <placeholder>
//    <changed block lines>
// <placeholder>
// returnd new full file content or undefined if we cannot confidently apply.
function attemptPatchForPartialSnippet(
  oldfile: string,
  newLazyFile: string,
): string | undefined {
  const rawLines = newLazyFile.split(/\r?\n/);
  const nonEmpty = rawLines.filter((line) => line.trim() !== "");
  if (nonEmpty.length < 2) {
    return undefined;
  }

  const firstIsPlaceHolder = isPlaceHolderLine(nonEmpty[0]);
  const lastIsPlaceHolder = isPlaceHolderLine(nonEmpty[nonEmpty.length - 1]);

  // case 1: placeholder ... snippet...placeholder (full sandwich)
  if (firstIsPlaceHolder && lastIsPlaceHolder && nonEmpty.length >= 3) {
    let firstIdx = rawLines.findIndex((line) => isPlaceHolderLine(line));
    let lastIdx = -1;
    for (let i = rawLines.length - 1; i >= 0; i--) {
      if (isPlaceHolderLine(rawLines[i])) {
        lastIdx = i;
        break;
      }
    }
    if (firstIdx >= 0 && lastIdx >= 0 && lastIdx - firstIdx >= 2) {
      const snippetCore = rawLines.slice(firstIdx + 1, lastIdx);
      return patchSnippetCore(oldfile, snippetCore);
    }
  }

  // case 2: snippet ... placeholder  (edit as the top and no placeholder)
  if (!firstIsPlaceHolder && lastIsPlaceHolder) {
    // extract snippet until last placeholder occurence
    let lastIdx = -1;
    for (let i = rawLines.length - 1; i >= 0; i--) {
      if (isPlaceHolderLine(rawLines[i])) {
        lastIdx = i;
        break;
      }
    }
    if (lastIdx > 0) {
      const snippetCore = rawLines.slice(0, lastIdx);
      return patchSnippetCore(oldfile, snippetCore, true /* top only */);
    }
  }

  return undefined;
}

// Attempt to patch when the model returns only a raw snippet (no placeholders) representing
// a contiguous region of the original file with modifications. We anchor on 1st and last
// non-empty lines. if both anchors appear exactly once and interior window length is reasonable
// we replace that window with the snoppet lines.
function attemptPatchForBareSnippet(
  oldFile: string,
  newLazyFile: string,
): string | undefined {
  const snippetLinesAll = newLazyFile.split(/\r?\n/);
  const oldLines = oldFile.split(/\r?\n/);
  if (snippetLinesAll.length >= oldLines.length) return undefined;

  // Extract meaningful (non-empty) lines for anchoring
  const meaningful = snippetLinesAll.filter((line) => line.trim() !== "");
  if (meaningful.length < 2) return undefined;

  const firstAnchor = meaningful[0].trim();
  const lastAnchor = meaningful[meaningful.length - 1].trim();
  if (!firstAnchor || !lastAnchor) return undefined;

  // locate unique occurances
  const firstIdxs: number[] = [];
  for (let i = 0; i < oldLines.length; i++) {
    if (oldLines[i].trim() === firstAnchor) {
      firstIdxs.push(i);
    }
  }
  if (firstIdxs.length !== 1) return undefined;
  const start = firstIdxs[0];

  let end = -1;

  for (let j = start; j < oldLines.length; j++) {
    if (oldLines[j].trim() === lastAnchor) {
      end = j;
    }
  }
  if (end < 0) return undefined;
  if (end - start + 1 > 5000) return undefined;

  const newContent = [
    ...oldLines.slice(0, start),
    ...snippetLinesAll,
    ...oldLines.slice(end + 1),
  ].join("\n");

  if (newContent === oldFile) return undefined;
  return newContent;
}

function patchSnippetCore(
  oldFile: string,
  snippetCoreRaw: string[],
  topOnly = false,
): string | undefined {
  const snippetCore = [...snippetCoreRaw];
  while (snippetCore.length > 0 && snippetCore[0].trim() === "") {
    snippetCore.shift();
  }
  while (
    snippetCore.length > 0 &&
    snippetCore[snippetCore.length - 1].trim() === ""
  ) {
    snippetCore.pop();
  }

  if (!snippetCore.length) return undefined;

  const oldLines = oldFile.split(/\r?\n/);
  const firstAnchor = snippetCore[0].trim();
  const lastAnchor = snippetCore[snippetCore.length - 1].trim();
  if (!firstAnchor) return undefined;

  if (topOnly) {
    for (let j = 0; j < oldLines.length; j++) {
      if (oldLines[j].trim() === lastAnchor) {
        const windowLen = j + 1;
        if (windowLen > 5000) continue;
        return [...snippetCore, ...oldLines.slice(j + 1)].join("\n");
      }
    }
    return undefined;
  }
  const candidateStarts: number[] = [];
  for (let i = 0; i < oldLines.length; i++) {
    if (oldLines[i].trim() === firstAnchor) {
      candidateStarts.push(i);
    }
  }
  if (candidateStarts.length === 0) return undefined;

  for (const start of candidateStarts) {
    for (let j = start; j < oldLines.length; j++) {
      if (oldLines[j].trim() === lastAnchor) {
        const windowLen = j - start + 1;
        if (windowLen > 5000) continue;
        return [
          ...oldLines.slice(0, start),
          ...snippetCore,
          ...oldLines.slice(j + 1),
        ].join("\n");
      }
    }
  }
  return undefined;
}

export async function applyCodeBlock(
  oldFile: string,
  newLazyFile: string,
  filename: string,
  llm: ILLM,
  abortController: AbortController,
): Promise<{
  isInstantApply: boolean;
  diffLinesGenerator: AsyncGenerator<DiffLine>;
}> {
  // Normalize EOLs and strip BOM for consistency
  const normalize = (s: string) => {
    if (!s) return s;
    // 0xfeff is BOM in UTF-8/UTF-16
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  };

  oldFile = normalize(oldFile);
  newLazyFile = normalize(newLazyFile);

  try {
    const provider = (llm as any)?.provider?.toLowerCase?.();

  const fulFileProviders = [
    "gemini",
    "vertexai_enterprise",
    "vertexai_enterprise_wif",
    "dbllm",
    "dbllmrev1",
  ]; // lowercased tokens

    const isEnforced = provider
      ? fulFileProviders.some((token) => provider.includes(token))
      : false;
    if (isEnforced) {
      const oldLineCount = oldFile.split(/\n/).length;
      const newLineCount = newLazyFile.split(/\n/).length;
      // for enforced providers, we forbid ANY placeholder varients (rest of code, unchanged_code, omitted, snip  etc)
      const placeHolderPattern =
        /(\/\/\.\.\.\s*(existing code|rest of code|omitted|omitted section|snip|snippet)\s*\.\.\.)|(UNCHANGED_CODE)|(\.\.\.\s*(existing code|rest of code|omitted|omitted section|snip|snippet)\s*\.\.\.)/i;
      const hasPlaceHolder = placeHolderPattern.test(newLazyFile);
      const looksToomSmall = newLineCount < 0.5 * oldLineCount;
      const suspicious = hasPlaceHolder || looksToomSmall;
      const oldLastMeaningful = [...oldFile.split(/\n/)]
        .reverse()
        .find((line) => line.trim().length);
      const newContainsLast = oldLastMeaningful
        ? newLazyFile.includes(oldLastMeaningful.trim())
        : true;
      if (suspicious && !newContainsLast) {
        throw new Error(
          "This provider must output complete updated file (no placeholders like '// ...existing code ...'. 'UNCHANGED_CODE' or any ellipsis variants, and no partial snippets).  Please regenerate with full file contents including unchanged sections.",
        );
      }
    }
  } catch (geminiGuardErr) {
    throw geminiGuardErr;
  }

  if (canUseInstantApply(filename)) {
    const diffLines = await deterministicApplyLazyEdit({
      oldFile,
      newLazyFile,
      filename,
      onlyFullFileRewrite: true,
    });

    if (diffLines !== undefined) {
      return {
        isInstantApply: true,
        diffLinesGenerator: generateLines(diffLines!),
      };
    }
  }

  const lazyDiffLines = await deterministicApplyLazyEdit({
    oldFile,
    newLazyFile,
    filename,
  });

  if (lazyDiffLines !== undefined) {
    return {
      isInstantApply: true,
      diffLinesGenerator: generateLines(lazyDiffLines),
    };
  }

  // Failback unsupported language partial snippet patch attempt (e.g. XML with placeholders)
  if (!canUseInstantApply(filename)) {
    const patched = attemptPatchForPartialSnippet(oldFile, newLazyFile);
    if (patched && patched !== oldFile) {
      const cleaned = stripEphemeralPlaceHolders(patched, oldFile);
      const diffLines = myersDiff(oldFile, cleaned);
      return {
        isInstantApply: true,
        diffLinesGenerator: generateLines(diffLines),
      };
    }

    // try bare snippet fallback (no placeholders)
    const barePatched = attemptPatchForBareSnippet(oldFile, newLazyFile);
    if (barePatched && barePatched !== oldFile) {
      const cleaned = stripEphemeralPlaceHolders(barePatched, oldFile);
      const diffLines = myersDiff(oldFile, cleaned);
      return {
        isInstantApply: true,
        diffLinesGenerator: generateLines(diffLines),
      };
    }
  }

  // If the code block is a diff
  if (isUnifiedDiffFormat(newLazyFile)) {
    try {
      const diffLines = applyUnifiedDiff(oldFile, newLazyFile);
      return {
        isInstantApply: true,
        diffLinesGenerator: generateLines(diffLines!),
      };
    } catch (e) {
      console.error("Failed to apply unified diff", e);
    }
  }

  return {
    isInstantApply: false,
    diffLinesGenerator: streamLazyApply(
      oldFile,
      filename,
      newLazyFile,
      llm,
      abortController,
    ),
  };
}
