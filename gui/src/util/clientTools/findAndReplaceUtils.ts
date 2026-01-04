import { EditOperation } from "core/tools/definitions/multiEdit";
import { maybeUnquoteLiteral } from "./unquote";

export const FOUND_MULTIPLE_FIND_STRINGS_ERROR =
  "Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.";

const MAX_LOCATION_COUNT = 5;

function detectLineEnding(content: string) {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

function normalizeLineEndings(value: string, lineEnding: string) {
  let normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (lineEnding === "\r\n") {
    normalized = normalized.replace(/\n/g, "\r\n");
  }
  return normalized;
}

function getLineStartOffsets(content: string) {
  const offsets = [0];
  for (let i = 0; i < content.length; i += 1) {
    if (content[i] === "\n") {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

function getLineNumberAtIndex(lineOffsets: number[], index: number) {
  let low = 0;
  let high = lineOffsets.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const offset = lineOffsets[mid];
    if (offset === index) {
      return mid + 1;
    }
    if (offset < index) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return Math.max(1, low);
}

function getOccurrenceLineNumbers(content: string, match: string) {
  const indices: number[] = [];
  let cursor = 0;
  while (cursor <= content.length) {
    const idx = content.indexOf(match, cursor);
    if (idx === -1) break;
    indices.push(idx);
    cursor = idx + Math.max(match.length, 1);
    if (indices.length >= MAX_LOCATION_COUNT) break;
  }
  if (indices.length === 0) return [];
  const lineOffsets = getLineStartOffsets(content);
  return indices.map((idx) => getLineNumberAtIndex(lineOffsets, idx));
}

function getSearchLines(search: string) {
  const normalized = search.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function findLineTrimmedMatches(content: string, search: string) {
  const contentLines = content.split("\n");
  const searchLines = getSearchLines(search);
  if (searchLines.length === 0) return [];

  const matches: Array<{ start: number; end: number }> = [];
  const lineOffsets = getLineStartOffsets(content);

  for (let i = 0; i <= contentLines.length - searchLines.length; i += 1) {
    let matchesAll = true;
    for (let j = 0; j < searchLines.length; j += 1) {
      const contentLine = contentLines[i + j]?.replace(/\r/g, "");
      if (contentLine.trim() !== searchLines[j].trim()) {
        matchesAll = false;
        break;
      }
    }
    if (matchesAll) {
      const start = lineOffsets[i] ?? 0;
      const end =
        lineOffsets[i + searchLines.length] ?? content.length;
      matches.push({ start, end });
      if (matches.length > MAX_LOCATION_COUNT) {
        break;
      }
    }
  }

  return matches;
}

function findAnchorMatches(content: string, search: string) {
  const searchLines = getSearchLines(search);
  if (searchLines.length < 3) return [];

  const contentLines = content.split("\n");
  const lineOffsets = getLineStartOffsets(content);
  const first = searchLines[0].trim();
  const last = searchLines[searchLines.length - 1].trim();

  const matches: Array<{ start: number; end: number }> = [];
  for (let i = 0; i <= contentLines.length - searchLines.length; i += 1) {
    const firstLine = contentLines[i]?.replace(/\r/g, "").trim();
    if (firstLine !== first) continue;
    const lastLine =
      contentLines[i + searchLines.length - 1]?.replace(/\r/g, "").trim();
    if (lastLine !== last) continue;
    const start = lineOffsets[i] ?? 0;
    const end = lineOffsets[i + searchLines.length] ?? content.length;
    matches.push({ start, end });
    if (matches.length > MAX_LOCATION_COUNT) {
      break;
    }
  }
  return matches;
}

/**
 * Performs a find and replace operation on text content with proper handling of special characters
 */
export function performFindAndReplace(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false,
  index?: number, // For error messages
): string {
  const errorContext = index !== undefined ? `edit at index ${index}: ` : "";
  // Check if old_string exists in current content

  if (oldString.startsWith('"') && oldString.endsWith('"')) {
    let maybeUnquotedOldString = maybeUnquoteLiteral(oldString);
    if (!content.includes(maybeUnquotedOldString)) {
      throw new Error(
        `${errorContext}String "${oldString}" not found in the file.`,
      );
    } else {
      // unquoted strings are required for replacement.
      oldString = maybeUnquotedOldString;
      newString = maybeUnquoteLiteral(newString);
    }
  } else if (!content.includes(oldString)) {
    const lineEnding = detectLineEnding(content);
    const normalizedOld = normalizeLineEndings(oldString, lineEnding);
    const normalizedNew = normalizeLineEndings(newString, lineEnding);
    if (content.includes(normalizedOld)) {
      oldString = normalizedOld;
      newString = normalizedNew;
    } else {
      const trimmedMatches = findLineTrimmedMatches(content, oldString);
      if (trimmedMatches.length === 1) {
        const match = trimmedMatches[0];
        oldString = content.slice(match.start, match.end);
      } else if (trimmedMatches.length > 1) {
        const lines = getOccurrenceLineNumbers(content, oldString).join(", ");
        throw new Error(
          `${errorContext}String "${oldString}" is not an exact match, but a whitespace-trimmed match appears ${trimmedMatches.length} times` +
            (lines ? ` (lines ${lines}). ` : ". ") +
            FOUND_MULTIPLE_FIND_STRINGS_ERROR,
        );
      } else {
        const anchorMatches = findAnchorMatches(content, oldString);
        if (anchorMatches.length === 1) {
          const match = anchorMatches[0];
          oldString = content.slice(match.start, match.end);
        } else if (anchorMatches.length > 1) {
          const lines = getOccurrenceLineNumbers(content, oldString).join(", ");
          throw new Error(
            `${errorContext}String "${oldString}" is not an exact match, but an anchor-based match appears ${anchorMatches.length} times` +
              (lines ? ` (lines ${lines}). ` : ". ") +
              FOUND_MULTIPLE_FIND_STRINGS_ERROR,
          );
        } else {
          throw new Error(
            `${errorContext}String "${oldString}" not found in the file.`,
          );
        }
      }
      newString = normalizeLineEndings(newString, lineEnding);
    }
  }

  const lineEnding = detectLineEnding(content);
  oldString = normalizeLineEndings(oldString, lineEnding);
  newString = normalizeLineEndings(newString, lineEnding);

  if (replaceAll) {
    // Replace all occurrences using replaceAll for proper handling of special characters
    return content.replaceAll(oldString, newString);
  } else {
    // Handle empty oldString case (insertion)
    if (oldString === "") {
      return newString + content;
    }

    // Count occurrences using indexOf for proper handling of special characters
    let count = 0;
    let searchIndex = content.indexOf(oldString);
    while (searchIndex !== -1) {
      count++;
      searchIndex = content.indexOf(oldString, searchIndex + 1);
    }

    if (count > 1) {
      const lines = getOccurrenceLineNumbers(content, oldString).join(", ");
      throw new Error(
        `${errorContext}String "${oldString}" appears ${count} times in the file` +
          (lines ? ` (lines ${lines}). ` : ". ") +
          FOUND_MULTIPLE_FIND_STRINGS_ERROR,
      );
    }

    // Replace only the first occurrence
    const firstIndex = content.indexOf(oldString);
    return (
      content.substring(0, firstIndex) +
      newString +
      content.substring(firstIndex + oldString.length)
    );
  }
}

/**
 * Validates a single edit operation
 */
export function validateSingleEdit(
  oldString: string,
  newString: string,
  index?: number,
): void {
  const context = index !== undefined ? `edit at index ${index}: ` : "";

  if (!oldString && oldString !== "") {
    throw new Error(`${context}old_string is required`);
  }
  if (newString === undefined) {
    throw new Error(`${context}new_string is required`);
  }
  if (oldString === newString) {
    throw new Error(`${context}old_string and new_string must be different`);
  }
}

export const EMPTY_NON_FIRST_EDIT_MESSAGE =
  "contains empty old_string. Only the first edit can contain an empty old_string, which is only used for file creation.";
export function validateCreatingForMultiEdit(edits: EditOperation[]) {
  const isCreating = edits[0].old_string === "";
  if (edits.length > 1) {
    if (isCreating) {
      throw new Error(
        "cannot make subsequent edits on a file you are creating",
      );
    } else {
      for (let i = 1; i < edits.length; i++) {
        if (edits[i].old_string === "") {
          throw new Error(
            `edit at index ${i}: ${EMPTY_NON_FIRST_EDIT_MESSAGE}`,
          );
        }
      }
    }
  }

  return isCreating;
}
