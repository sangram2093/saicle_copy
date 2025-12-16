declare module "pdf-parse" {
  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, any>;
    metadata?: Record<string, any>;
    text: string;
    version: string;
  }

  function pdfParse(
    data: Buffer | Uint8Array,
    options?: Record<string, any>,
  ): Promise<PDFParseResult>;

  export = pdfParse;
}
