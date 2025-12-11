import { workspace } from "vscode";

export const DBSAICLE_WORKSPACE_KEY = "dbsaicle";

export function getDbSaicleWorkspaceConfig() {
  return workspace.getConfiguration(DBSAICLE_WORKSPACE_KEY);
}
