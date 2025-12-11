export function maybeUnquoteLiteral(s: string): string {
  if (
    s.length > 1 &&
    s.startsWith('"') &&
    s.endsWith('"') &&
    !s.includes("\n") &&
    /\\n|\\t|\\r|\\"|\\\\/.test(s)
  ) {
    try {
      return JSON.parse(s);
    } catch {
      // fallback best effort
      return s
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\r/g, "\r")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
  }
  return s;
}
