import * as vscode from "vscode";

import { BrowserController, BrowserSnapshot } from "./BrowserController";

type PanelMessage =
  | { type: "launch"; url: string }
  | { type: "click"; coordinate: { x: number; y: number } }
  | { type: "type"; text: string }
  | { type: "scroll"; direction: "up" | "down" }
  | { type: "refresh" }
  | { type: "close" }
  | { type: "state" };

export class BrowserPanel {
  private panel?: vscode.WebviewPanel;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly controller: BrowserController,
  ) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      void this.sendCurrentState();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "dbsaicleBrowser",
      "DbSaicle Browser",
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false,
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    this.panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      "icon.png",
    );
    this.panel.webview.html = this.getHtml(this.panel.webview);

    const subscription = this.panel.webview.onDidReceiveMessage(
      (message: PanelMessage) => {
        void this.handleMessage(message);
      },
    );

    this.panel.onDidDispose(() => {
      subscription.dispose();
      this.panel = undefined;
      this.controller.dispose();
    });

    void this.sendCurrentState();
  }

  public postState(snapshot: BrowserSnapshot): void {
    this.panel?.webview.postMessage({ type: "state", payload: snapshot });
  }

  public postError(message: string): void {
    this.panel?.webview.postMessage({ type: "error", message });
  }

  public postLoading(message: string): void {
    this.panel?.webview.postMessage({ type: "loading", message });
  }

  private async handleMessage(message: PanelMessage): Promise<void> {
    switch (message.type) {
      case "launch":
        if (!message.url) {
          return this.postError("A valid URL is required.");
        }
        await this.runAction("Launching browser.", () =>
          this.controller.launch(message.url),
        );
        break;
      case "click":
        await this.runAction("Clicking.", () =>
          this.controller.click(message.coordinate.x, message.coordinate.y),
        );
        break;
      case "type":
        if (!message.text) {
          return this.postError("Enter text before typing.");
        }
        await this.runAction("Typing.", () =>
          this.controller.type(message.text),
        );
        break;
      case "scroll":
        await this.runAction("Scrolling.", () =>
          this.controller.scroll(message.direction),
        );
        break;
      case "refresh":
        await this.runAction("Refreshing.", () => this.controller.refresh());
        break;
      case "close":
        await this.runAction("Closing browser.", () =>
          this.controller.closeBrowser(),
        );
        break;
      case "state":
        await this.sendCurrentState();
        break;
      default:
        break;
    }
  }

  private async runAction(
    status: string,
    action: () => Promise<BrowserSnapshot>,
  ): Promise<void> {
    this.postLoading(status);

    try {
      const snapshot = await action();
      this.postState(snapshot);
    } catch (error) {
      console.error("Browser action failed:", error);
      this.postError(
        error instanceof Error ? error.message : String(error ?? "Unknown error"),
      );
    }
  }

  private async sendCurrentState(): Promise<void> {
    const snapshot = await this.controller.currentState();
    this.postState(snapshot);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const csp = [
      "default-src 'none'",
      "img-src data: https:",
      "style-src 'unsafe-inline'",
      `script-src 'nonce-${nonce}'`,
      "font-src 'none'",
      "connect-src 'none'",
    ].join("; ");

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta http-equiv="Content-Security-Policy" content="${csp}">
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            :root {
              color-scheme: light dark;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            body {
              margin: 0;
              padding: 0;
              background: transparent;
            }
            .container {
              padding: 12px;
              display: flex;
              flex-direction: column;
              gap: 12px;
            }
            .row {
              display: flex;
              gap: 8px;
              flex-wrap: wrap;
            }
            input[type="text"] {
              flex: 1;
              min-width: 180px;
              padding: 6px 8px;
              border-radius: 4px;
              border: 1px solid var(--vscode-editorWidget-border, #555);
              background: var(--vscode-input-background, #1e1e1e);
              color: var(--vscode-input-foreground, #ddd);
            }
            button {
              padding: 6px 12px;
              border-radius: 4px;
              border: 1px solid var(--vscode-button-border, transparent);
              background: var(--vscode-button-background, #007acc);
              color: var(--vscode-button-foreground, white);
              cursor: pointer;
            }
            button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
            .screenshot-wrapper {
              position: relative;
              background: var(--vscode-editor-background, #1e1e1e);
              border: 1px solid var(--vscode-editorWidget-border, #555);
              border-radius: 4px;
              overflow: hidden;
            }
            .screenshot-wrapper::before {
              content: "";
              display: block;
              padding-bottom: calc((600 / 900) * 100%);
            }
            #screenshot {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: contain;
              background: #000;
            }
            #overlay {
              position: absolute;
              inset: 0;
              cursor: crosshair;
            }
            .status {
              font-size: 0.9rem;
              color: var(--vscode-descriptionForeground, #888);
            }
            pre {
              margin: 0;
              padding: 8px;
              border-radius: 4px;
              border: 1px solid var(--vscode-editorWidget-border, #555);
              background: var(--vscode-editor-background, #1e1e1e);
              font-size: 0.85rem;
              max-height: 180px;
              overflow: auto;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="row">
              <input type="text" id="urlInput" placeholder="https://example.com" />
              <button id="launchBtn">Launch</button>
              <button id="refreshBtn">Refresh</button>
              <button id="closeBtn">Close</button>
            </div>
            <div class="row">
              <input type="text" id="textInput" placeholder="Type text." />
              <button id="typeBtn">Type</button>
              <button id="scrollUpBtn">Scroll Up</button>
              <button id="scrollDownBtn">Scroll Down</button>
            </div>
            <div class="screenshot-wrapper">
              <img id="screenshot" alt="Browser preview" />
              <div id="overlay"></div>
            </div>
            <div class="status" id="status">Browser is idle.</div>
            <pre id="logs">(No console logs yet)</pre>
          </div>
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const urlInput = document.getElementById("urlInput");
            const textInput = document.getElementById("textInput");
            const launchBtn = document.getElementById("launchBtn");
            const refreshBtn = document.getElementById("refreshBtn");
            const closeBtn = document.getElementById("closeBtn");
            const typeBtn = document.getElementById("typeBtn");
            const scrollUpBtn = document.getElementById("scrollUpBtn");
            const scrollDownBtn = document.getElementById("scrollDownBtn");
            const screenshotEl = document.getElementById("screenshot");
            const overlay = document.getElementById("overlay");
            const statusEl = document.getElementById("status");
            const logsEl = document.getElementById("logs");

            let currentViewport = { width: 900, height: 600 };
            let lastUrl = "";

            function setStatus(message) {
              statusEl.textContent = message;
            }

            function setLogs(logs) {
              if (!logs || logs.length === 0) {
                logsEl.textContent = "(No console logs yet)";
                return;
              }
              logsEl.textContent = logs.join("\\n");
            }

            function enableActions(enabled) {
              refreshBtn.disabled = !enabled;
              closeBtn.disabled = !enabled;
              typeBtn.disabled = !enabled;
              scrollUpBtn.disabled = !enabled;
              scrollDownBtn.disabled = !enabled;
            }

            launchBtn.addEventListener("click", () => {
              const url = urlInput.value.trim();
              vscode.postMessage({ type: "launch", url });
            });
            refreshBtn.addEventListener("click", () => {
              vscode.postMessage({ type: "refresh" });
            });
            closeBtn.addEventListener("click", () => {
              vscode.postMessage({ type: "close" });
            });
            typeBtn.addEventListener("click", () => {
              const text = textInput.value;
              vscode.postMessage({ type: "type", text });
            });
            scrollUpBtn.addEventListener("click", () => {
              vscode.postMessage({ type: "scroll", direction: "up" });
            });
            scrollDownBtn.addEventListener("click", () => {
              vscode.postMessage({ type: "scroll", direction: "down" });
            });

            overlay.addEventListener("click", (event) => {
              if (!screenshotEl.src) {
                return;
              }
              const rect = overlay.getBoundingClientRect();
              const xRatio = (event.clientX - rect.left) / rect.width;
              const yRatio = (event.clientY - rect.top) / rect.height;
              const coordinate = {
                x: Math.round(xRatio * currentViewport.width),
                y: Math.round(yRatio * currentViewport.height),
              };
              vscode.postMessage({ type: "click", coordinate });
            });

            window.addEventListener("message", (event) => {
              const message = event.data;
              switch (message.type) {
                case "loading":
                  setStatus(message.message);
                  break;
                case "error":
                  setStatus(message.message || "Browser error");
                  break;
                case "state":
                  const payload = message.payload;
                  currentViewport = payload.viewport || currentViewport;
                  enableActions(!!payload.screenshot);
                  if (payload.url) {
                    lastUrl = payload.url;
                    urlInput.value = payload.url;
                  }
                  if (payload.screenshot) {
                    screenshotEl.src = payload.screenshot;
                  } else {
                    screenshotEl.removeAttribute("src");
                  }
                  setLogs(payload.logs);
                  setStatus(payload.status || (payload.screenshot ? "Ready" : "Browser idle"));
                  break;
                default:
                  break;
              }
            });

            vscode.postMessage({ type: "state" });
          </script>
        </body>
      </html>
    `;
  }
}

function getNonce(): string {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 16; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
