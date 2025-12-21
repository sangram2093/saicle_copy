export const DEFAULT_CHUNK_SIZE_CHARS = parseInt(
  process.env.AURA_PDF_CHUNK_SIZE_CHARS || "12000",
  10,
);

export function chunkText(text: string, maxChars: number): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  return chunks;
}
