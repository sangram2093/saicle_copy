import {
  AssistantChatMessage,
  ChatMessage,
  CompletionOptions,
} from "../../index.js";

export interface AdaptiveRetryConfig {
  enableAuto: boolean;
  originalMaxTokens?: number;
  attemptsLimit: number;
  maxTokensCeiling?: number;
  retainLast: number;
  summaryCharBudget: number;
  legendHeader: string;
  allowAttemptExtension: boolean;
  isV1API?: boolean;
}

export type StreamFn = (
  messages: ChatMessage[],
  options: CompletionOptions,
) => AsyncGenerator<ChatMessage>;

/**
 * Compact earlier conversation into a single synthetic summary user message.
 * System message (if any) can be preserved for non-v1 endpoints.
 */
function compactConversation(
  messages: ChatMessage[],
  retainLast: number,
  targetCharBudget: number,
  legendHeader: string,
  isV1API?: boolean,
): ChatMessage[] {
  if (messages.length <= retainLast + 1) {
    return messages;
  }
  const systemMaybe = messages[0]?.role === "system" ? messages[0] : null;
  const startIndex = systemMaybe ? 1 : 0;
  const tail = messages.slice(-retainLast);
  const head = messages.slice(startIndex, messages.length - retainLast);
  if (head.length === 0) {
    return messages;
  } // should not happen

  let used = 0;
  const parts: string[] = [];
  for (const m of head) {
    let contentText = "";
    if (typeof m.content === "string") {
      contentText = m.content;
    } else if (Array.isArray(m.content)) {
      contentText = m.content
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join(" ");
    } else if (m.content && typeof m.content === "object") {
      const maybe = (m.content as any).text;
      if (maybe) {
        contentText = maybe;
      }
    }
    contentText = contentText.replace(/\s+/g, " ").trim();
    if (!contentText) {
      continue;
    }
    const snippet = contentText.slice(0, 220);
    const prefix =
      m.role === "user"
        ? "U:"
        : m.role === "assistant"
          ? "A:"
          : m.role === "tool"
            ? "T:"
            : "O:";
    const line = `${prefix} ${snippet}`;
    if (used + line.length > targetCharBudget) {
      break;
    }
    used += line.length;
    parts.push(line);
  }
  if (parts.length === 0) {
    return messages;
  } // should not happen
  const summaryText = `${legendHeader}\n${parts.join("\n")}`;
  const summaryMessage: ChatMessage = { role: "user", content: summaryText };
  const newMessages: ChatMessage[] = [];
  if (systemMaybe && !isV1API) {
    newMessages.push(systemMaybe);
  }
  newMessages.push(summaryMessage, ...tail);
  return newMessages;
}

export function logSlicer(text: string) {
  if (!text || typeof text !== "string") {
    return;
  }
  let partNum = 1;
  let remainingText = text;
  const chunkSize = 150;
  while (remainingText.length > chunkSize) {
    let chunk = remainingText.substring(0, chunkSize);
    let lastSpace = chunk.lastIndexOf(" ");
    if (lastSpace !== -1) {
      console.log(`msg ${partNum++}: ${remainingText.substring(0, lastSpace)}`);
      remainingText = remainingText.substring(lastSpace + 1);
    } else {
      console.log(`msg ${partNum++}: ${chunk}`);
      remainingText = remainingText.substring(chunkSize);
    }
  }
  if (remainingText.length > 0) {
    console.log(`msg ${partNum++}: ${remainingText}`);
  }
}

/**
 * shared adaptive streaming with truncation detection, dynamic attempt extension,
 * token expension, and one-time conversation compaction.
 */
export async function* adaptiveStreamWithCompaction(params: {
  messages: ChatMessage[];
  signal: AbortSignal;
  options: CompletionOptions;
  streamFn: StreamFn;
  config: AdaptiveRetryConfig;
}): AsyncGenerator<ChatMessage> {
  const {
    messages,
    signal,
    options,
    streamFn,
    config: {
      enableAuto,
      originalMaxTokens,
      attemptsLimit: initialAttemptsLimit,
      maxTokensCeiling: initialCeiling,
      retainLast,
      summaryCharBudget,
      legendHeader,
      allowAttemptExtension,
      isV1API,
    },
  } = params;

  let workingMessages = messages;
  let attemptsLimit = initialAttemptsLimit;
  let attempt = 0;
  let expanded = false;
  let maxTokensCeiling = initialCeiling;
  let compacted = false;
  while (true) {
    if (signal.aborted) {
      return;
    }
    attempt++;
    let truncatedDetected = false;
    const streamingOptions = { ...options };
    if (expanded && streamingOptions.maxTokens) {
      const ceilingValInner = maxTokensCeiling ?? streamingOptions.maxTokens;
      streamingOptions.maxTokens = Math.min(
        streamingOptions.maxTokens,
        ceilingValInner,
      );
    }

    const iterator = streamFn(workingMessages, streamingOptions);
    for await (const message of iterator) {
      if (signal.aborted) {
        return;
      }
      if (message.role === "assistant") {
        const a = message as AssistantChatMessage;
        if (a.truncated) {
          truncatedDetected = true;
        }
      }
      if (!enableAuto || (enableAuto && !truncatedDetected)) {
        // this is where the message is not truncated
        const text = (message?.content as any[])[0]?.text;
        logSlicer(text);
        yield message;
      }
    }

    // Extend attempts limit if allowed and truncation hit the edge.
    if (
      enableAuto &&
      truncatedDetected &&
      attempt === attemptsLimit &&
      allowAttemptExtension
    ) {
      attemptsLimit++;
      if (!streamingOptions.provideCompletedMsg) {
        yield {
          role: "assistant",
          content: [
            {
              type: "text",
              text: ` Truncation detected on attempt ${attempt}. Extending retry allowance to ${attemptsLimit} attempts.`,
            },
          ],
          finishReason: "Extending_MAX_TOKEN_RETRIES",
        } as AssistantChatMessage;
      }
    }

    if (enableAuto && truncatedDetected && attempt < attemptsLimit) {
      // seed a baseline original maxtokens if not provided so expansion can proceed.(
      const seededOriginal =
        originalMaxTokens ?? options.maxTokens ?? (options as any).max_tokens;

      // One-time compaction
      if (!compacted) {
        const compactedResult = compactConversation(
          workingMessages,
          retainLast,
          summaryCharBudget,
          legendHeader,
          isV1API,
        );
        if (compactedResult !== workingMessages) {
          workingMessages = compactedResult;
          compacted = true;
          if (!streamingOptions.provideCompletedMsg) {
            yield {
              role: "assistant",
              content: [
                {
                  type: "text",
                  text: `Conversation compacted to reduce prompt token usage before retry.`,
                },
              ],
              finishReason: "CONVERSATION_COMPACTED",
            } as AssistantChatMessage;
          }
        }
      }
      const current = options.maxTokens ?? seededOriginal;
      if (!maxTokensCeiling) {
        const modelContext = (undefined as any)?.contextLength || 0;
        maxTokensCeiling = modelContext > 0 ? modelContext : current * 4;
      }
      const next = Math.min(
        current * 2,
        maxTokensCeiling ?? Number.MAX_SAFE_INTEGER,
      );
      if (next > current) {
        options.maxTokens = next;
        expanded = true;
        if (!streamingOptions.provideCompletedMsg) {
          yield {
            role: "assistant",
            content: [
              {
                type: "text",
                text: `Partial reponse truncated at ${current} tokens. Retrying with maxTokens=${next} (attempt ${attempt + 1}/${attemptsLimit}).`,
              },
            ],
            finishReason: "RETRYING_MAX_TOKENS_EXPANSION",
          } as AssistantChatMessage;
        }
        continue; // retry
      } else {
        yield {
          role: "assistant",
          content: [
            {
              type: "text",
              text: `Truncation detected but maxTokens cannot grow (current=${current}, ceiling=${maxTokensCeiling}). Proceeding without further expansion.`,
            },
          ],
          finishReason: "MAX_TOKEN_EXPANSION_BLOCKED",
        } as AssistantChatMessage;
      }
    }
    break;
  }
}
