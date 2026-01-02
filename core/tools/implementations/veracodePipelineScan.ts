import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { fetchwithRequestOptions } from "@dbsaicledev/fetch";
import type { RequestInit } from "node-fetch";

import { ContextItem, ToolExtras } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getNumberArg, getOptionalStringArg, getStringArg } from "../parseArgs";
import { resolveRelativePathInDir } from "../../util/ideUtils";

const DEFAULT_BASE_URL = "https://api.veracode.com";
const DEFAULT_POLL_INTERVAL_SEC = 4;
const DEFAULT_TIMEOUT_SEC = 900;
const DEFAULT_USER_AGENT = "dbsaicle-veracode";

const SEVERITY_NAMES = [
  "Informational",
  "Very Low",
  "Low",
  "Medium",
  "High",
  "Very High",
];

type VeracodeProxyConfig = {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  url?: string;
};

type VeracodeConfig = {
  apiKeyId?: string;
  apiKeySecret?: string;
  baseUrl?: string;
  userAgent?: string;
  proxy?: VeracodeProxyConfig;
};

type VeracodePipelineScanArgs = {
  artifact_path: string;
  output_json_path?: string;
  poll_interval_sec?: number;
  timeout_sec?: number;
};

type PipelineScanResponse = {
  scan_id?: string;
  binary_segments_expected?: number;
};

function getVeracodeConfig(config: any): VeracodeConfig {
  const veracodeConfig = config?.veracode || {};
  return {
    apiKeyId: veracodeConfig.apiKeyId,
    apiKeySecret: veracodeConfig.apiKeySecret,
    baseUrl: veracodeConfig.baseUrl,
    userAgent: veracodeConfig.userAgent,
    proxy: veracodeConfig.proxy,
  };
}

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (trimmed.includes("/pipeline_scan")) {
    return trimmed;
  }
  return `${trimmed}/pipeline_scan/v1`;
}

function buildProxyUrl(proxy?: VeracodeProxyConfig): string | undefined {
  if (!proxy) return undefined;
  if (proxy.url) return String(proxy.url);
  if (!proxy.host) return undefined;
  const host = proxy.host;
  const hasScheme = host.startsWith("http://") || host.startsWith("https://");
  const scheme = hasScheme ? "" : "http://";
  const port = typeof proxy.port !== "undefined" ? `:${proxy.port}` : "";
  const user = proxy.username ? encodeURIComponent(proxy.username) : "";
  const pass = proxy.password ? encodeURIComponent(proxy.password) : "";
  const auth = user ? `${user}${pass ? `:${pass}` : ""}@` : "";
  return `${scheme}${auth}${host}${port}`;
}

function hexToBuffer(hex: string) {
  return Buffer.from(hex, "hex");
}

function hmac256(
  data: string | Buffer,
  key: Buffer,
  encoding?: "hex",
): Buffer | string {
  const hmac = crypto.createHmac("sha256", key).update(data);
  return encoding ? hmac.digest(encoding) : hmac.digest();
}

function generateVeracodeAuthHeader(
  apiId: string,
  apiSecret: string,
  url: URL,
  method: string,
) {
  const urlPath = `${url.pathname}${url.search}`;
  const data = `id=${apiId}&host=${url.host}&url=${urlPath}&method=${method}`;
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString("hex");

  const hashedNonce = hmac256(hexToBuffer(nonce), hexToBuffer(apiSecret)) as Buffer;
  const hashedTimestamp = hmac256(timestamp, hashedNonce) as Buffer;
  const hashedVersion = hmac256("vcode_request_version_1", hashedTimestamp) as Buffer;
  const signature = hmac256(data, hashedVersion, "hex") as string;

  return `VERACODE-HMAC-SHA-256 id=${apiId},ts=${timestamp},nonce=${nonce},sig=${signature}`;
}

async function veracodeRequest(
  extras: ToolExtras,
  config: {
    apiKeyId: string;
    apiKeySecret: string;
    userAgent: string;
    proxyUrl?: string;
  },
  url: URL,
  method: string,
  body?: any,
  headers?: Record<string, string>,
  timeoutMs = 0,
) {
  const authHeader = generateVeracodeAuthHeader(
    config.apiKeyId,
    config.apiKeySecret,
    url,
    method.toUpperCase(),
  );

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": config.userAgent,
    Authorization: authHeader,
    ...headers,
  };

  const init: RequestInit = {
    method: method.toUpperCase(),
    headers: finalHeaders,
  };

  if (typeof body !== "undefined") {
    init.body = body;
  }

  const controller = timeoutMs ? new AbortController() : undefined;
  let timeoutId: NodeJS.Timeout | undefined;
  if (controller && timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    init.signal = controller.signal;
  }

  try {
    const response = config.proxyUrl
      ? await fetchwithRequestOptions(url, init, {
          proxy: config.proxyUrl,
        })
      : await extras.fetch(url.toString(), init);

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Veracode API error (${response.status}): ${text || response.statusText}`,
      );
    }
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function createScanPayload(file: Buffer, fileName: string) {
  return {
    binary_hash: crypto.createHash("sha256").update(file).digest("hex"),
    binary_name: fileName,
    binary_size: file.byteLength,
  };
}

function splitIntoSegments(file: Buffer, segmentCount: number) {
  const segments: Buffer[] = [];
  const size = file.byteLength / segmentCount;
  for (let i = 0; i < segmentCount; i += 1) {
    const start = Math.floor(i * size);
    const end =
      i === segmentCount - 1 ? file.byteLength : Math.floor((i + 1) * size);
    segments.push(file.slice(start, end));
  }
  return segments;
}

function severityName(value: number | undefined) {
  if (typeof value !== "number") return "Unknown";
  return SEVERITY_NAMES[value] || "Unknown";
}

function buildReport(findings: any[], artifactName: string, scanId: string) {
  const counts = new Map<string, number>();
  findings.forEach((finding) => {
    const name = severityName(finding?.severity);
    counts.set(name, (counts.get(name) || 0) + 1);
  });

  const highFindings = findings.filter(
    (finding) => typeof finding?.severity === "number" && finding.severity >= 4,
  );

  const lines: string[] = [];
  lines.push("## Veracode Pipeline Scan Report", "");
  lines.push(`- Artifact: \`${artifactName}\``);
  lines.push(`- Scan ID: \`${scanId}\``);
  lines.push(`- Findings: ${findings.length}`, "");

  lines.push("### Summary");
  SEVERITY_NAMES.forEach((sev) => {
    lines.push(`- ${sev}: ${counts.get(sev) || 0}`);
  });

  lines.push("", "### High and Very High Findings");
  if (!highFindings.length) {
    lines.push("- None");
    return lines.join("\n");
  }

  highFindings.forEach((finding) => {
    const sev = severityName(finding?.severity);
    const cweId = finding?.cwe_id ? `CWE-${finding.cwe_id}` : "CWE-Unknown";
    const issueType = finding?.issue_type || "Unknown issue";
    const sourceFile = finding?.files?.source_file;
    const location = sourceFile?.file
      ? `${sourceFile.file}${sourceFile.line ? `:${sourceFile.line}` : ""}`
      : "Unknown location";
    const issueId = finding?.issue_id ? String(finding.issue_id) : undefined;

    lines.push(
      "",
      `- ${cweId}: ${issueType}`,
      `  - Severity: ${sev}`,
      `  - Location: \`${location}\``,
      ...(issueId ? [`  - Issue ID: ${issueId}`] : []),
    );
  });

  return lines.join("\n");
}

function toFsPath(maybeUri: string) {
  return maybeUri.startsWith("file:") ? fileURLToPath(maybeUri) : maybeUri;
}

function resolveOptionalPath(
  value: string | undefined,
  workspaceDir: string | undefined,
) {
  if (!value) return undefined;
  if (value.startsWith("file:")) {
    return fileURLToPath(value);
  }
  if (path.isAbsolute(value)) return value;
  if (workspaceDir) return path.join(toFsPath(workspaceDir), value);
  return path.resolve(value);
}

export const veracodePipelineScanImpl: ToolImpl = async (
  args: VeracodePipelineScanArgs,
  extras,
) => {
  const requestedPath = getStringArg(args, "artifact_path").trim();
  let artifactPath: string | undefined;

  if (requestedPath.startsWith("file:")) {
    artifactPath = fileURLToPath(requestedPath);
  } else if (path.isAbsolute(requestedPath)) {
    artifactPath = requestedPath;
  } else {
    const resolvedUri = await resolveRelativePathInDir(
      requestedPath,
      extras.ide,
    );
    if (!resolvedUri) {
      throw new Error(`Artifact not found: ${requestedPath}`);
    }
    artifactPath =
      resolvedUri.startsWith("file://") || resolvedUri.startsWith("file:")
        ? fileURLToPath(resolvedUri)
        : path.resolve(requestedPath);
  }

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }

  const config = getVeracodeConfig(extras.config);
  const apiKeyId =
    config.apiKeyId || process.env.VERACODE_API_KEY_ID || "";
  const apiKeySecret =
    config.apiKeySecret || process.env.VERACODE_API_KEY_SECRET || "";
  if (!apiKeyId || !apiKeySecret) {
    throw new Error(
      "Veracode API credentials are required. Set veracode.apiKeyId and veracode.apiKeySecret (or VERACODE_API_KEY_ID / VERACODE_API_KEY_SECRET).",
    );
  }

  const baseUrl =
    config.baseUrl || process.env.VERACODE_BASE_URL || DEFAULT_BASE_URL;
  const pipelineBase = normalizeBaseUrl(baseUrl);
  const userAgent =
    config.userAgent || process.env.VERACODE_USER_AGENT || DEFAULT_USER_AGENT;
  const proxyUrl = buildProxyUrl(config.proxy);

  const pollInterval =
    typeof args.poll_interval_sec !== "undefined"
      ? getNumberArg(args as any, "poll_interval_sec")
      : DEFAULT_POLL_INTERVAL_SEC;
  const timeoutSec =
    typeof args.timeout_sec !== "undefined"
      ? getNumberArg(args as any, "timeout_sec")
      : DEFAULT_TIMEOUT_SEC;

  const artifactBuffer = await fs.promises.readFile(artifactPath);
  const artifactName = path.basename(artifactPath);

  void extras.ide.showToast("info", `Starting Veracode scan for ${artifactName}`);

  const scanUrl = new URL(`${pipelineBase}/scans`);
  const scanResponse = (await veracodeRequest(
    extras,
    {
      apiKeyId,
      apiKeySecret,
      userAgent,
      proxyUrl,
    },
    scanUrl,
    "POST",
    JSON.stringify(createScanPayload(artifactBuffer, artifactName)),
    { "Content-Type": "application/json" },
  )) as PipelineScanResponse;

  if (!scanResponse.scan_id || !scanResponse.binary_segments_expected) {
    throw new Error("Veracode scan initialization failed.");
  }

  const scanId = scanResponse.scan_id;
  const segmentCount = scanResponse.binary_segments_expected;

  void extras.ide.showToast(
    "info",
    `Uploading ${segmentCount} scan segments...`,
  );

  const { default: FormData } = await import("form-data");
  const segments = splitIntoSegments(artifactBuffer, segmentCount);
  for (let i = 0; i < segments.length; i += 1) {
    const segmentUrl = new URL(
      `${pipelineBase}/scans/${scanId}/segments/${i}`,
    );
    const form = new FormData();
    form.append("file", segments[i], {
      filename: "file",
    });
    const headers = form.getHeaders();
    try {
      const length = form.getLengthSync();
      headers["Content-Length"] = String(length);
    } catch {
      // ignore length errors
    }

    await veracodeRequest(
      extras,
      { apiKeyId, apiKeySecret, userAgent, proxyUrl },
      segmentUrl,
      "PUT",
      form,
      headers,
    );
    if ((i + 1) % 5 === 0 || i + 1 === segments.length) {
      void extras.ide.showToast(
        "info",
        `Uploaded ${i + 1}/${segments.length} segments...`,
      );
    }
  }

  const startUrl = new URL(`${pipelineBase}/scans/${scanId}`);
  await veracodeRequest(
    extras,
    { apiKeyId, apiKeySecret, userAgent, proxyUrl },
    startUrl,
    "PUT",
    JSON.stringify({ scan_status: "STARTED" }),
    { "Content-Type": "application/json" },
  );

  void extras.ide.showToast("info", "Veracode scan running...");

  const timeoutMs = timeoutSec * 1000;
  const pollIntervalMs = pollInterval * 1000;
  const startTime = Date.now();
  let scanStatus = "UNKNOWN";

  while (Date.now() - startTime < timeoutMs) {
    const statusUrl = new URL(`${pipelineBase}/scans/${scanId}`);
    const statusResponse = await veracodeRequest(
      extras,
      { apiKeyId, apiKeySecret, userAgent, proxyUrl },
      statusUrl,
      "GET",
    );
    scanStatus = statusResponse?.scan_status || "UNKNOWN";
    if (!["PENDING", "STARTED", "UPLOADING"].includes(scanStatus)) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  if (scanStatus === "UNKNOWN") {
    throw new Error("Failed to determine Veracode scan status.");
  }
  if (["PENDING", "STARTED", "UPLOADING"].includes(scanStatus)) {
    throw new Error("Veracode scan timed out before completion.");
  }
  if (scanStatus === "ERROR" || scanStatus === "FAILED") {
    throw new Error(`Veracode scan failed with status: ${scanStatus}`);
  }

  const findingsUrl = new URL(`${pipelineBase}/scans/${scanId}/findings`);
  const findingsResponse = await veracodeRequest(
    extras,
    { apiKeyId, apiKeySecret, userAgent, proxyUrl },
    findingsUrl,
    "GET",
  );
  const findings = Array.isArray(findingsResponse?.findings)
    ? findingsResponse.findings
    : [];

  const workspaceDirs = await extras.ide.getWorkspaceDirs();
  const outputPath = resolveOptionalPath(
    getOptionalStringArg(args, "output_json_path", true),
    workspaceDirs?.[0],
  );
  if (outputPath) {
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(findingsResponse, null, 2),
      "utf-8",
    );
  }

  void extras.ide.showToast(
    "info",
    `Veracode scan complete. Findings: ${findings.length}`,
  );

  const report = buildReport(findings, artifactName, scanId);

  const contextItems: ContextItem[] = [
    {
      name: "Veracode Pipeline Scan",
      description: "Pipeline scan report",
      content: report,
    },
  ];

  if (outputPath) {
    contextItems.push({
      name: "Veracode Findings JSON",
      description: "Saved raw findings JSON",
      content: `Saved to: ${outputPath}`,
    });
  }

  return contextItems;
};
