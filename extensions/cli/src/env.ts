import * as os from "os";
import * as path from "path";

import dotenv from "dotenv";

dotenv.config();

export const env = {
  apiBase: process.env.DBSAICLE_API_BASE ?? "https://api.dbsaicle.dev/",
  workOsClientId:
    process.env.WORKOS_CLIENT_ID ?? "client_01J0FW6XN8N2XJAECF7NE0Y65J",
  appUrl: process.env.HUB_URL || "https://hub.dbsaicle.dev",
  dbsaicleHome:
    process.env.DBSAICLE_GLOBAL_DIR || path.join(os.homedir(), ".dbsaicle"),
};
