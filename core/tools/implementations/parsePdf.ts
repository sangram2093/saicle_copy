import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getBooleanArg, getNumberArg, getOptionalStringArg, getStringArg } from "../parseArgs";

type ParsePdfArgs = {
  pdfPath: string;
  includeImages?: boolean;
  maxPages?: number;
};

type PageImage = { page: number; dataUrl: string };

async function renderPageImages(
  pdfPath: string,
  maxPages?: number,
): Promise<PageImage[]> {
  let pdfjs: typeof import("pdfjs-dist") | null = null;
  try {
    pdfjs = await import("pdfjs-dist");
  } catch {
    return [];
  }

  // Optional dependency: canvas. If missing, skip images gracefully.
  let Canvas: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Canvas = require("canvas");
  } catch {
    return [];
  }

  const data = await fs.promises.readFile(pdfPath);
  const loadingTask = (pdfjs as any).getDocument({
    data,
    useSystemFonts: true,
  });
  const doc: PDFDocumentProxy = await loadingTask.promise;

  const NodeCanvasFactory = {
    create(width: number, height: number) {
      const canvas = Canvas.createCanvas(width, height);
      const context = canvas.getContext("2d");
      return { canvas, context };
    },
    reset(canvasAndContext: any, width: number, height: number) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy(canvasAndContext: any) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    },
  };

  const pageImages: PageImage[] = [];
  const limit = maxPages && maxPages > 0 ? Math.min(maxPages, doc.numPages) : doc.numPages;

  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvasAndContext = NodeCanvasFactory.create(
      viewport.width,
      viewport.height,
    );
    const renderContext = {
      canvasContext: canvasAndContext.context,
      viewport,
      canvasFactory: NodeCanvasFactory as any,
    };
    await page.render(renderContext).promise;
    const dataUrl = canvasAndContext.canvas.toDataURL("image/png");
    pageImages.push({ page: i, dataUrl });
    NodeCanvasFactory.destroy(canvasAndContext);
  }
  await doc.destroy();
  return pageImages;
}

function formatJson(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return `${obj}`;
  }
}

export const parsePdfImpl: ToolImpl = async (args: ParsePdfArgs, extras) => {
  const pdfPath = path.resolve(getStringArg(args, "pdfPath"));
  const includeImages = getBooleanArg(args as any, "includeImages", false) ?? false;
  const maxPages =
    typeof args?.maxPages !== "undefined" ? getNumberArg(args as any, "maxPages") : undefined;

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  const buffer = await fs.promises.readFile(pdfPath);
  const parsed = await pdfParse(buffer);

  let images: PageImage[] = [];
  let imageNote = "";
  if (includeImages) {
    try {
      images = await renderPageImages(pdfPath, maxPages);
      if (!images.length) {
        imageNote =
          "Image rendering skipped (missing optional dependencies like canvas) or no images found.";
      }
    } catch (err) {
      imageNote = `Image rendering failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const contextItems: ContextItem[] = [
    {
      name: "PDF Text",
      description: `Extracted text from ${path.basename(pdfPath)}`,
      content: parsed.text,
    },
    {
      name: "PDF Metadata",
      description: "Metadata and stats",
      content: `\`\`\`json\n${formatJson({
        pages: parsed.numpages,
        info: parsed.info,
        version: parsed.version,
      })}\n\`\`\``,
    },
  ];

  if (includeImages) {
    if (images.length) {
      images.forEach((img) => {
        contextItems.push({
          name: `PDF Page ${img.page}`,
          description: "Rendered page image",
          content: `![Page ${img.page}](${img.dataUrl})`,
        });
      });
    } else {
      contextItems.push({
        name: "PDF Images",
        description: "Image rendering",
        content: imageNote || "No images extracted.",
      });
    }
  }

  return contextItems;
};
