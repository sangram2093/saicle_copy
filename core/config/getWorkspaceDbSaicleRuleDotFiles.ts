import { ConfigValidationError } from "@dbsaicledev/config-yaml";
import type { FileType, IDE, RuleWithSource } from "..";
import { joinPathsToUri } from "../util/uri";
export const SYSTEM_PROMPT_DOT_FILE = ".dbsaiclerules";

export async function getWorkspaceDbSaicleRuleDotFiles(ide: IDE) {
  const dirs = await ide.getWorkspaceDirs();

  const errors: ConfigValidationError[] = [];
  const rules: RuleWithSource[] = [];
  for (const dir of dirs) {
    try {
      const dotFile = joinPathsToUri(dir, SYSTEM_PROMPT_DOT_FILE);
      const exists = await ide.fileExists(dotFile);
      if (exists) {
        const content = await ide.readFile(dotFile);
        rules.push({
          rule: content,
          ruleFile: dotFile,
          source: ".dbsaiclerules",
        });
      }
    } catch (e) {
      errors.push({
        fatal: false,
        message: `Failed to load system prompt dot file from workspace ${dir}: ${e instanceof Error ? e.message : e}`,
      });
    }

    // Load all .md files from .dbsaicle/rules folder
    try {
      const rulesFolder = joinPathsToUri(dir, ".dbsaicle", "rules");
      const filesList = await ide.listDir(rulesFolder);

      if (filesList && filesList.length > 0) {
        for (const [fileName, fileType] of filesList) {
          // Filter only .md files (not directories)
          if (fileName.endsWith(".md") && fileType === (1 as FileType.File)) {
            try {
              const filePath = joinPathsToUri(rulesFolder, fileName);
              const content = await ide.readFile(filePath);
              rules.push({
                rule: content,
                ruleFile: filePath,
                source: "colocated-markdown",
              });
            } catch (fileError) {
              errors.push({
                fatal: false,
                message: `Failed to load rule file from .dbsaicle/rules: ${fileName}: ${fileError instanceof Error ? fileError.message : fileError}`,
              });
            }
          }
        }
      }
    } catch (e) {
      // Silently skip if .dbsaicle/rules folder doesn't exist
      if (!(e instanceof Error && e.message.includes("does not exist"))) {
        errors.push({
          fatal: false,
          message: `Failed to load rules from .dbsaicle/rules folder in workspace ${dir}: ${e instanceof Error ? e.message : e}`,
        });
      }
    }
  }

  return { rules, errors };
}
