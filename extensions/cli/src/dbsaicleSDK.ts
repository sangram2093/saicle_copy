import { DbSaicle, DbSaicleClient } from "@dbsaicledev/sdk";
import chalk from "chalk";

import { env } from "./env.js";

/**
 * Initialize the DbSaicle SDK with the given parameters
 * @param apiKey - API key to use for authentication
 * @param assistantSlug - Slug of the assistant to use
 * @param organizationId - Optional organization ID
 * @returns Promise resolving to the DbSaicle SDK instance
 */
export async function initializeDbSaicleSDK(
  apiKey: string | undefined,
  assistantSlug: string,
  organizationId?: string,
): Promise<DbSaicleClient> {
  if (!apiKey) {
    console.error(chalk.red("Error: No API key provided for DbSaicle SDK"));
    throw new Error("No API key provided for DbSaicle SDK");
  }

  try {
    return await DbSaicle.from({
      apiKey,
      assistant: assistantSlug,
      organizationId,
      baseURL: env.apiBase,
    });
  } catch (error) {
    console.error(
      chalk.red("Error initializing DbSaicle SDK:"),
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
