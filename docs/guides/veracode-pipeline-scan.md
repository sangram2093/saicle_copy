# Veracode Pipeline Scan Tool

This guide explains how to run the `veracode_pipeline_scan` tool to scan a built artifact using Veracode Pipeline Scan.

## Prerequisites

- A build artifact exists (JAR, WAR, EAR, ZIP, APK).
- Veracode API credentials are available.

## Configuration (config.yaml)

```yaml
veracode:
  apiKeyId: "YOUR_KEY_ID"
  apiKeySecret: "YOUR_KEY_SECRET"
  baseUrl: "https://api.veracode.com" # optional
  userAgent: "dbsaicle-veracode"      # optional
  proxy:                              # optional
    url: "http://user:pass@proxy.company.com:8080"
```

Environment variable fallbacks:

- `VERACODE_API_KEY_ID`
- `VERACODE_API_KEY_SECRET`
- `VERACODE_BASE_URL`
- `VERACODE_USER_AGENT`
- `VERACODE_PROXY_URL`
- `VERACODE_PROXY_HOST`
- `VERACODE_PROXY_PORT`
- `VERACODE_PROXY_USERNAME`
- `VERACODE_PROXY_PASSWORD`

## Usage

Minimal tool call:

```json
{
  "artifact_path": "dist/app.jar"
}
```

Optional parameters:

```json
{
  "artifact_path": "dist/app.jar",
  "output_json_path": "veracode-findings.json",
  "poll_interval_sec": 4,
  "timeout_sec": 900
}
```

## Output

The tool returns a Markdown report that includes:

- Artifact name
- Scan ID
- Finding counts by severity
- High/Very High findings (if present)

If `output_json_path` is set, the raw findings JSON is written to that file.

## Progress Messages

During a scan, you will see toasts for:

- Scan start
- Segment upload progress (every 5 segments and at completion)
- Scan running
- Scan completion (with total findings)

## Notes

- This tool uses Veracode Pipeline Scan REST APIs with HMAC auth.
- It does not invoke a local Veracode JAR.
