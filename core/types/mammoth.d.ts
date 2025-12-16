declare module "mammoth" {
  export interface MammothMessage {
    type: string;
    message: string;
  }

  export interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }

  export function extractRawText(
    input: { path?: string; buffer?: Buffer },
    options?: Record<string, any>,
  ): Promise<MammothResult>;

  export function convertToHtml(
    input: { path?: string; buffer?: Buffer },
    options?: Record<string, any>,
  ): Promise<MammothResult>;

  const _default: {
    extractRawText: typeof extractRawText;
    convertToHtml: typeof convertToHtml;
  };

  export default _default;
}
