import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const veracodePipelineScanTool: Tool = {
  type: "function",
  readonly: true,
  isInstant: false,
  group: BUILT_IN_GROUP_NAME,
  displayTitle: "Veracode Pipeline Scan",
  wouldLikeTo: "scan an artifact with Veracode Pipeline Scan",
  isCurrently: "scanning the artifact with Veracode Pipeline Scan",
  hasAlready: "scanned the artifact with Veracode Pipeline Scan",
  defaultToolPolicy: "allowedWithPermission",
  function: {
    name: BuiltInToolNames.VeracodePipelineScan,
    description:
      "Run a Veracode Pipeline Scan on a build artifact (JAR/WAR/EAR/ZIP/APK) and return a Markdown report.",
    parameters: {
      type: "object",
      required: ["artifact_path"],
      properties: {
        artifact_path: {
          type: "string",
          description:
            "Path to the build artifact to scan (JAR/WAR/EAR/ZIP/APK).",
        },
        output_json_path: {
          type: "string",
          description:
            "Optional path to write the raw findings JSON (useful for auditing).",
        },
        poll_interval_sec: {
          type: "number",
          description:
            "Polling interval in seconds for scan status (default: 4).",
        },
        timeout_sec: {
          type: "number",
          description:
            "Maximum time to wait for scan completion in seconds (default: 900).",
        },
      },
    },
  },
};
