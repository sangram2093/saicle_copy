import { ChatMessage } from "../..";
import { dedent } from "../../util";

export const UNCHANGED_CODE = "UNCHANGED CODE";

type LazyApplyPrompt = (
  oldCode: string,
  filename: string,
  newCode: string,
) => ChatMessage[];

const RULES = [
  "Your response should be a code block containing a rewritten version of the file.",
  `Whenever any part of the code is the same as before, you may simply indicate this with a comment that says "${UNCHANGED_CODE}" instead of rewriting.`,
  "You must keep at least one line above and below from the original code, so that we can identify what the previous code was.",
  `Do not place miscellaneous "${UNCHANGED_CODE}" comments at the top or bottom of the file when there is nothing to replace them.`,
  // `You should write "${UNCHANGED_CODE}" at least for each function that is unchanged, rather than grouping them into a single comment.`,
  // `You should lean toward using a smaller number of these comments rather than rewriting it for every function if all of them are unchanged.`,
  // `You may do this for imports as well if needed.`,
  // `Do not explain your changes either before or after the code block.`,
  "The code should always be syntactically valid, even with the comments.",
];

function claude35SonnetLazyApplyPrompt(
  ...args: Parameters<LazyApplyPrompt>
): ReturnType<LazyApplyPrompt> {
  const userContent = dedent`
    ORIGINAL CODE:
    \`\`\`${args[1]}
    ${args[0]}
    \`\`\`

    NEW CODE:
    \`\`\`
    ${args[2]}
    \`\`\`

    Above is a code block containing the original version of a file (ORIGINAL CODE) and below it is a code snippet (NEW CODE) that was suggested as modification to the original file. Your task is to apply the NEW CODE to the ORIGINAL CODE and show what the entire file would look like after it is applied.
    - ${RULES.join("\n- ")}
  `;

  const assistantContent = dedent`
    Sure! Here's the modified version of the file after applying the new code:
    \`\`\`${args[1]}
  `;

  return [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ];
}

const GEMINI_RULES = [
  "Return the entire updated file inside a code block whose info string includes the filename, for example ```ts path/to/file.ts.",
  `When a section is unchanged, replace it with a short comment that contains the exact phrase "${UNCHANGED_CODE}" so tooling can stitch the original contents back in.`,
  "Keep the file syntactically correct and avoid extra narration outside the code block.",
];

function geminiLazyApplyPrompt(
  ...args: Parameters<LazyApplyPrompt>
): ReturnType<LazyApplyPrompt> {
  const userContent = dedent`
    ORIGINAL CODE:
    \`\`\`${args[1]}
    ${args[0]}
    \`\`\`

    NEW CODE:
    \`\`\`
    ${args[2]}
    \`\`\`

    Apply the NEW CODE changes to the ORIGINAL CODE and respond with the full updated file.
    - ${GEMINI_RULES.join("\n    - ")}
  `;

  const assistantContent = dedent`
    Certainly! Here is the updated file with the requested edits applied:
    \`\`\`${args[1]}
  `;

  return [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ];
}

export function lazyApplyPromptForModel(
  model: string,
  provider: string,
): LazyApplyPrompt | undefined {
  const lowerModel = model.toLowerCase();
  const lowerProvider = provider.toLowerCase();

  if (lowerModel.includes("sonnet")) {
    return claude35SonnetLazyApplyPrompt;
  }

  if (
    lowerModel.includes("gemini") ||
    lowerProvider === "gemini" ||
    (lowerProvider === "vertexai" && lowerModel.includes("gemini"))
  ) {
    return geminiLazyApplyPrompt;
  }

  return undefined;
}
