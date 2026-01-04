import { resolveRelativePathInDir } from "../../util/ideUtils";
import { getUriPathBasename } from "../../util/uri";

import { ToolImpl } from ".";
import { throwIfFileIsSecurityConcern } from "../../indexing/ignore";
import { getStringArg } from "../parseArgs";
import { throwIfFileExceedsHalfOfContext } from "./readFileLimit";

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

export const readFileImpl: ToolImpl = async (args, extras) => {
  const filepath = getStringArg(args, "filepath");
  throwIfFileIsSecurityConcern(filepath);

  const firstUriMatch = await withRetry(
    () => resolveRelativePathInDir(filepath, extras.ide),
    3,
    50,
  );
  let resolvedUri = firstUriMatch;
  if (!resolvedUri) {
    const openFiles = await extras.ide.getOpenFiles();
    const matches = openFiles.filter((uri) => uri.endsWith(filepath));
    if (matches.length === 1) {
      resolvedUri = matches[0];
    } else if (matches.length > 1) {
      const names = matches.map((uri) => getUriPathBasename(uri)).join(", ");
      throw new Error(
        `Multiple open files match "${filepath}": ${names}. Provide a more specific path.`,
      );
    }
  }
  if (!resolvedUri) {
    throw new Error(
      `File "${filepath}" does not exist. You might want to check the path and try again.`,
    );
  }
  const content = await withRetry(() => extras.ide.readFile(resolvedUri), 3, 50);

  await throwIfFileExceedsHalfOfContext(
    filepath,
    content,
    extras.config.selectedModelByRole.chat,
  );

  return [
    {
      name: getUriPathBasename(resolvedUri),
      description: filepath,
      content,
      uri: {
        type: "file",
        value: resolvedUri,
      },
    },
  ];
};
