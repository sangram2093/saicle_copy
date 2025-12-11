// ProfileHandlers manage the loading of a config, allowing us to abstract over different ways of getting to a DbSaicleConfig

import { ConfigResult } from "@dbsaicledev/config-yaml";
import { DbSaicleConfig } from "../../index.js";
import { ProfileDescription } from "../ProfileLifecycleManager.js";

// After we have the DbSaicleConfig, the ConfigHandler takes care of everything else (loading models, lifecycle, etc.)
export interface IProfileLoader {
  description: ProfileDescription;
  doLoadConfig(): Promise<ConfigResult<DbSaicleConfig>>;
  setIsActive(isActive: boolean): void;
}
