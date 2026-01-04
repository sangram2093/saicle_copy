import ignore from "ignore";

import { ToolImpl } from ".";
import { walkDir } from "../../indexing/walkDir";
import { resolveRelativePathInDir } from "../../util/ideUtils";

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 100,
  backoffMultiplier = 2,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

export function resolveLsToolDirPath(dirPath: string | undefined) {
  if (!dirPath || dirPath === ".") {
    return "/";
  }
  if (dirPath.startsWith(".")) {
    return dirPath.slice(1);
  }
  return dirPath.replace(/\\/g, "/");
}

const MAX_LS_TOOL_LINES = 200;

export const lsToolImpl: ToolImpl = async (args, extras) => {
  const dirPath = resolveLsToolDirPath(args?.dirPath);
  const uri = await withRetry(
    () => resolveRelativePathInDir(dirPath, extras.ide),
    3,
    50,
  );
  if (!uri) {
    throw new Error(
      `Directory ${args.dirPath} not found. Make sure to use forward-slash paths`,
    );
  }

  const entries = await withRetry(
    () =>
      walkDir(uri, extras.ide, {
        returnRelativeUrisPaths: true,
        include: "both",
        recursive: args?.recursive ?? false,
        overrideDefaultIgnores: ignore(), // Show all directories including dist/, build/, etc.
      }),
    3,
    50,
  );

  const lines = entries.slice(0, MAX_LS_TOOL_LINES);

  let content =
    lines.length > 0
      ? lines.join("\n")
      : `No files/folders found in ${dirPath}`;

  const contextItems = [
    {
      name: "File/folder list",
      description: `Files/folders in ${dirPath}`,
      content,
    },
  ];

  if (entries.length > MAX_LS_TOOL_LINES) {
    let warningContent = `${entries.length - MAX_LS_TOOL_LINES} ls entries were truncated`;
    if (args?.recursive) {
      warningContent += ". Try using a non-recursive search";
    }
    contextItems.push({
      name: "Truncation warning",
      description: "",
      content: warningContent,
    });
  }

  return contextItems;
};
