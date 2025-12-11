/**
 * Parse OTEL header strings (e.g. "key1=value1,key2=value2") into an object.
 */
export function parseOtelHeaders(
  headers: string | undefined,
): Record<string, string> {
  if (!headers) return {};

  return headers
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, entry) => {
      const [key, ...rest] = entry.split("=");
      const name = key?.trim();
      if (!name) return acc;

      const value = rest.join("=").trim();
      if (value) acc[name] = value;
      return acc;
    }, {});
}

/**
 * Rough detection of the current terminal so we can tag telemetry.
 */
export function detectTerminalType(): string | null {
  if (process.env.WT_SESSION) return "windows-terminal";
  if (process.env.TERM_PROGRAM) return process.env.TERM_PROGRAM;
  if (process.env.TERM) return process.env.TERM;
  if (process.env.ConEmuPID) return "conemu";
  return null;
}
