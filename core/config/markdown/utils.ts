import {
  RULE_FILE_EXTENSION,
  sanitizeRuleName,
} from "@dbsaicledev/config-yaml";
import { joinPathsToUri } from "../../util/uri";

/**
 * Creates the file path for a rule in the workspace .dbsaicle/rules directory
 */
export function createRuleFilePath(
  workspaceDir: string,
  ruleName: string,
): string {
  const safeRuleName = sanitizeRuleName(ruleName);
  return joinPathsToUri(
    workspaceDir,
    ".dbsaicle",
    "rules",
    `${safeRuleName}.${RULE_FILE_EXTENSION}`,
  );
}
