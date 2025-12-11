import * as vscode from "vscode";

import { BrowserController, BrowserSnapshot } from "./BrowserController";
import { BrowserPanel } from "./BrowserPanel";

export interface BrowserActionRequest {
  action:
    | "launch"
    | "click"
    | "type"
    | "scroll_down"
    | "scroll_up"
    | "refresh"
    | "close";
  url?: string;
  coordinate?: { x: number; y: number };
  text?: string;
}

export class BrowserIntegration implements vscode.Disposable {
  private readonly controller: BrowserController;
  private readonly panel: BrowserPanel;
  private readonly command: vscode.Disposable;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.controller = new BrowserController(context);
    this.panel = new BrowserPanel(context, this.controller);
    this.command = vscode.commands.registerCommand(
      "dbsaicle.openBrowserPanel",
      () => this.panel.show(),
    );

    context.subscriptions.push(this);
  }

  async handleAction(request: BrowserActionRequest): Promise<BrowserSnapshot> {
    this.panel.show();
    this.panel.postLoading(this.getStatusMessage(request.action));

    try {
      const snapshot = await this.executeRequest(request);
      this.panel.postState(snapshot);
      return snapshot;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown error");
      this.panel.postError(message);
      throw error;
    }
  }

  dispose(): void {
    this.command.dispose();
    this.controller.dispose();
  }

  private async executeRequest(
    request: BrowserActionRequest,
  ): Promise<BrowserSnapshot> {
    switch (request.action) {
      case "launch":
        if (!request.url) {
          throw new Error("Launch action requires a URL.");
        }
        return await this.controller.launch(request.url);
      case "click":
        if (!request.coordinate) {
          throw new Error("Click action requires coordinates.");
        }
        return await this.controller.click(
          request.coordinate.x,
          request.coordinate.y,
        );
      case "type":
        if (!request.text) {
          throw new Error("Type action requires text to type.");
        }
        return await this.controller.type(request.text);
      case "scroll_down":
        return await this.controller.scroll("down");
      case "scroll_up":
        return await this.controller.scroll("up");
      case "refresh":
        return await this.controller.refresh();
      case "close":
        return await this.controller.closeBrowser();
      default:
        throw new Error(`Unsupported browser action: ${request.action}`);
    }
  }

  private getStatusMessage(action: BrowserActionRequest["action"]): string {
    switch (action) {
      case "launch":
        return "Launching browser.";
      case "click":
        return "Clicking.";
      case "type":
        return "Typing.";
      case "scroll_down":
      case "scroll_up":
        return "Scrolling.";
      case "refresh":
        return "Refreshing.";
      case "close":
        return "Closing browser.";
      default:
        return "Running browser action.";
    }
  }
}

export type { BrowserSnapshot } from "./BrowserController";
