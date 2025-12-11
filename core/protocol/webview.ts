import { ConfigResult } from "@dbsaicledev/config-yaml";
import { SerializedOrgWithProfiles } from "../config/ProfileLifecycleManager.js";
import { ControlPlaneSessionInfo } from "../control-plane/AuthTypes.js";
import type {
  BrowserSerializedDbSaicleConfig,
  ContextItemWithId,
  ContextProviderName,
  IndexingProgressUpdate,
  IndexingStatus,
} from "../index.js";

export type ToWebviewFromIdeOrCoreProtocol = {
  configUpdate: [
    {
      result: ConfigResult<BrowserSerializedDbSaicleConfig>;
      profileId: string | null;
      organizations: SerializedOrgWithProfiles[];
      selectedOrgId: string | null;
    },
    void,
  ];
  getDefaultModelTitle: [undefined, string | undefined];
  indexProgress: [IndexingProgressUpdate, void]; // Codebase
  "indexing/statusUpdate": [IndexingStatus, void]; // Docs, etc.
  refreshSubmenuItems: [
    {
      providers: "all" | "dependsOnIndexing" | ContextProviderName[];
    },
    void,
  ];
  didCloseFiles: [{ uris: string[] }, void];
  isDbSaicleInputFocused: [undefined, boolean];
  addContextItem: [
    {
      historyIndex: number;
      item: ContextItemWithId;
    },
    void,
  ];
  setTTSActive: [boolean, void];
  getWebviewHistoryLength: [undefined, number];
  getCurrentSessionId: [undefined, string];
  "jetbrains/setColors": [Record<string, string | null | undefined>, void];
  sessionUpdate: [{ sessionInfo: ControlPlaneSessionInfo | undefined }, void];
  toolCallPartialOutput: [{ toolCallId: string; contextItems: any[] }, void];
  freeTrialExceeded: [undefined, void];
};
