import { ToolCallDelta } from "../../..";
import { createDelta } from "../systemToolUtils";
import { ToolCallParseState } from "../types";

type FinalizeResult = {
  delta?: ToolCallDelta;
  appendedClosing: boolean;
};

export function finalizeCurrentArg(
  state: ToolCallParseState,
  appendClosing: boolean,
): FinalizeResult {
  if (!state.currentArgName && state.currentArgChunks.length === 0) {
    return { appendedClosing: false };
  }
  if (!state.currentArgName) {
    state.currentArgChunks.length = 0;
    return { appendedClosing: false };
  }

  const argName = state.currentArgName;
  let trimmedValue = state.currentArgChunks.join("").trim();
  trimmedValue = trimmedValue.replace(/\r\n/g, "\n");

  const clipPatterns = [
    /```tool/i,
    /TOOL_NAME\s*:/i,
    /I will now call/i,
    /I'll call/i,
    /Let me call/i,
  ];

  for (const pattern of clipPatterns) {
    const match = trimmedValue.match(pattern);
    if (match && match.index !== undefined) {
      trimmedValue = trimmedValue.slice(0, match.index).trimEnd();
    }
  }

  if (!trimmedValue.length) {
    state.currentArgChunks.length = 0;
    state.currentArgName = undefined;
    return { appendedClosing: appendClosing };
  }

  state.currentArgChunks.length = 0;
  state.currentArgName = undefined;
  state.processedArgNames.add(argName);

  let stringifiedArg: string;
  try {
    if (
      trimmedValue.startsWith("[") ||
      trimmedValue.startsWith("{")
    ) {
      trimmedValue = trimmedValue.replace(
        /"((?:\\[\s\S]|[^"\\])*?)"/g,
        (match) => {
          const content = match.slice(1, -1);
          return (
            '"' +
            content
              .replace(/([^\\])\n/g, "$1\\n")
              .replace(/^\n/g, "\\n") +
            '"'
          );
        },
      );
      const parsed = JSON.parse(trimmedValue);
      stringifiedArg = JSON.stringify(parsed);
    } else {
      stringifiedArg = JSON.stringify(trimmedValue);
    }
  } catch (e) {
    stringifiedArg = JSON.stringify(trimmedValue);
  }

  if (appendClosing) {
    stringifiedArg += "}";
  }

  return {
    delta: createDelta("", stringifiedArg, state.toolCallId),
    appendedClosing: appendClosing,
  };
}

/*
  Efficiently applies chunks to a tool call state as they come in
  Expects chunks to be broken so that new lines and codeblocks are alone
  For now, this parser collects entire arg before
  This is because support for JSON booleans is tricky otherwise
*/
export function handleToolCallBuffer(
  chunk: string,
  state: ToolCallParseState,
): ToolCallDelta | undefined {
  // Add chunks
  const lineIndex = state.currentLineIndex;
  if (!state.lineChunks[lineIndex]) {
    state.lineChunks[lineIndex] = [];
  }
  state.lineChunks[lineIndex].push(chunk);

  const isNewLine = chunk === "\n";
  if (isNewLine) {
    state.currentLineIndex++;
  }

  const line = state.lineChunks[lineIndex].join("");

  switch (lineIndex) {
    // The first line will be skipped (e.g. ```tool\n)
    case 0:
      // non-standard start sequences will sometimes include stuff in the tool_name line
      const splitBuffer = line.split("\n");
      if (splitBuffer[0]) {
        state.lineChunks[0] = [splitBuffer[0], "\n"];
      }
      if (splitBuffer[1]) {
        state.lineChunks[1] = [splitBuffer[1]];
      }

      state.currentLineIndex = 1;
    // Tool name line - process once line 2 is reached
    case 1:
      if (isNewLine) {
        const name = (line.split(/tool_?name:/i)[1] ?? "").trim();
        if (!name) {
          throw new Error("Invalid tool name");
        }
        return createDelta(name, "", state.toolCallId);
      }
      return;
    default:
      if (state.isWithinArgStart) {
      if (isNewLine) {
        const argName = (line.split(/begin_?arg:/i)[1] ?? "").trim();
        if (!argName) {
          throw new Error("Invalid begin arg line");
        }
          state.currentArgName = argName;
          state.isWithinArgStart = false;
          const argPrefix = state.processedArgNames.size === 0 ? "{" : ",";
          return createDelta("", `${argPrefix}"${argName}":`, state.toolCallId);
        }
      } else if (state.currentArgName) {
        if (isNewLine) {
          const isEndArgTag = line.match(/end_?arg/i);
          if (isEndArgTag) {
            const { delta } = finalizeCurrentArg(state, false);
            if (delta) {
              return delta;
            }
          } else {
            state.currentArgChunks.push(line);
          }
        }
      } else {
        // Check for entry into arg
        const isBeginArgLine = line.match(/begin_?arg:/i);
        if (isBeginArgLine) {
          state.isWithinArgStart = true;
        }

        // Check for exit
        if (line === "```" || isNewLine) {
          if (line === "```") {
            const { delta, appendedClosing } = finalizeCurrentArg(
              state,
              true,
            );
            state.done = true;
            if (delta) {
              return delta;
            }
            if (state.processedArgNames.size > 0 && !appendedClosing) {
              return createDelta("", "}", state.toolCallId);
            }
          } else {
            state.done = true;
            if (state.processedArgNames.size > 0) {
              return createDelta("", "}", state.toolCallId);
            }
          }
        }
      }
  }
}
