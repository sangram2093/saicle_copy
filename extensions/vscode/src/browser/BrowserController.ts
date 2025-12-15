import * as fs from "node:fs/promises";
import * as path from "node:path";

import PCR from "puppeteer-chromium-resolver";
import type { Browser, Page } from "puppeteer-core";
import * as vscode from "vscode";

type ResolverStats = Awaited<ReturnType<typeof PCR>>;

export interface BrowserSnapshot {
  screenshot?: string;
  url?: string;
  logs?: string[];
  viewport: { width: number; height: number };
  mousePosition?: { x: number; y: number };
  status?: string;
}

export class BrowserController implements vscode.Disposable {
  private browser?: Browser;
  private page?: Page;
  private resolverStats?: ResolverStats;
  private logs: string[] = [];
  private readonly viewport = { width: 900, height: 600 };
  private lastMousePosition?: { x: number; y: number };

  constructor(private readonly context: vscode.ExtensionContext) {}

  async launch(url: string): Promise<BrowserSnapshot> {
    await this.disposeBrowser();

    const stats = await this.ensureChromium();
    const launchOptions = await this.getLaunchOptions(stats);
    try {
      this.browser = await stats.puppeteer.launch(launchOptions);
    } catch (error) {
      const hint =
        "Failed to start Chromium. Try running the DbSaicle: Reset Browser command or ensure Chrome is installed and accessible.";
      throw new Error(`${(error as Error).message}\n\n${hint}`);
    }

    this.page = await this.browser!.newPage();
    this.logs = [];
    this.registerPageListeners(this.page);
    await this.page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

    return await this.captureState("Browser launched");
  }

  async click(x: number, y: number): Promise<BrowserSnapshot> {
    const page = this.requirePage();
    await page.mouse.click(x, y);
    this.lastMousePosition = { x, y };
    return await this.captureState("Clicked at coordinates");
  }

  async type(text: string): Promise<BrowserSnapshot> {
    const page = this.requirePage();
    await page.keyboard.type(text, { delay: 20 });
    return await this.captureState("Typed text");
  }

  async scroll(direction: "up" | "down"): Promise<BrowserSnapshot> {
    const page = this.requirePage();
    const delta =
      direction === "down"
        ? this.viewport.height * 0.9
        : -this.viewport.height * 0.9;
    await page.evaluate(
      (amount) => window.scrollBy({ top: amount, behavior: "smooth" }),
      delta,
    );
    return await this.captureState(
      direction === "down" ? "Scrolled down" : "Scrolled up",
    );
  }

  async refresh(): Promise<BrowserSnapshot> {
    const page = this.requirePage();
    await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
    return await this.captureState("Page refreshed");
  }

  async closeBrowser(): Promise<BrowserSnapshot> {
    await this.disposeBrowser();
    return {
      viewport: this.viewport,
      status: "Browser closed",
      logs: [],
    };
  }

  async currentState(): Promise<BrowserSnapshot> {
    if (!this.page) {
      return {
        viewport: this.viewport,
        status: "Browser is not running",
        logs: [],
      };
    }
    return await this.captureState();
  }

  dispose(): void {
    void this.disposeBrowser();
  }

  private async ensureChromium(): Promise<ResolverStats> {
    if (this.resolverStats) {
      return this.resolverStats;
    }

    const downloadPath = path.join(
      this.context.globalStorageUri.fsPath,
      "chromium",
    );
    await fs.mkdir(downloadPath, { recursive: true });

    this.resolverStats = await PCR({
      revision: "1266853",
      downloadPath,
      hosts: [
        "https://storage.googleapis.com",
        "https://npm.taobao.org/mirrors",
      ],
      silent: true,
    });

    return this.resolverStats;
  }

  private async getLaunchOptions(stats: ResolverStats): Promise<any> {
    const baseOptions: any = {
      headless: true,
      defaultViewport: this.viewport,
    };

    const envPath =
      process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROME_PATH;
    if (envPath) {
      if (await this.pathExists(envPath)) {
        return { ...baseOptions, executablePath: envPath };
      }
      throw new Error(
        `PUPPETEER_EXECUTABLE_PATH was set but not found at: ${envPath}`,
      );
    }

    const exe = stats.executablePath;
    if (exe && (await this.pathExists(exe))) {
      return { ...baseOptions, executablePath: exe };
    }

    // Fallback: use installed Chrome channel if resolver didn't provide a path.
    return { ...baseOptions, channel: "chrome" };
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private requirePage(): Page {
    if (!this.page) {
      throw new Error(
        "Browser is not running. Launch a page before performing this action.",
      );
    }
    return this.page;
  }

  private async captureState(status?: string): Promise<BrowserSnapshot> {
    if (!this.page) {
      return {
        viewport: this.viewport,
        status: status ?? "Browser is not running",
        logs: [...this.logs],
      };
    }

    let screenshot: string | undefined = undefined;
    try {
      const base64 = await this.page.screenshot({
        type: "webp",
        fullPage: false,
        encoding: "base64",
      });
      screenshot = `data:image/webp;base64,${base64}`;
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
    }

    return {
      screenshot,
      url: this.page.url(),
      logs: [...this.logs],
      viewport: this.viewport,
      mousePosition: this.lastMousePosition,
      status,
    };
  }

  private async disposeBrowser(): Promise<void> {
    if (this.page) {
      try {
        await this.page.close();
      } catch (error) {
        console.warn("Failed to close page:", error);
      }
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.warn("Failed to close browser:", error);
      }
    }
    this.browser = undefined;
    this.page = undefined;
    this.logs = [];
    this.lastMousePosition = undefined;
  }

  private registerPageListeners(page: Page): void {
    page.on("console", (msg) => {
      const entry = `[${msg.type()}] ${msg.text()}`;
      this.logs.push(entry);
      if (this.logs.length > 50) {
        this.logs.shift();
      }
    });

    page.on("pageerror", (error) => {
      this.logs.push(`[pageerror] ${error.message}`);
      if (this.logs.length > 50) {
        this.logs.shift();
      }
    });
  }
}
