import fs from "fs";

import { getDbSaicleGlobalPath } from "core/util/paths";
import { ExtensionContext } from "vscode";

/**
 * Clear all DbSaicle-related artifacts to simulate a brand new user
 */
export function cleanSlate(context: ExtensionContext) {
  // Commented just to be safe
  // // Remove ~/.dbsaicle
  // const dbsaiclePath = getDbSaicleGlobalPath();
  // if (fs.existsSync(dbsaiclePath)) {
  //   fs.rmSync(dbsaiclePath, { recursive: true, force: true });
  // }
  // // Clear extension's globalState
  // context.globalState.keys().forEach((key) => {
  //   context.globalState.update(key, undefined);
  // });
}
