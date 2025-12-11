import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { getOptionalStringArg, getStringArg } from "../parseArgs";

type BrowserActionRequest = {
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
};

type BrowserSnapshot = {
  screenshot?: string;
  url?: string;
  logs?: string[];
  viewport?: { width: number; height: number };
  mousePosition?: { x: number; y: number };
  status?: string;
};

const ACTIONS = new Set([
  "launch",
  "click",
  "type",
  "scroll_down",
  "scroll_up",
  "refresh",
  "close",
]);

function formatCoordinate(coord?: { x: number; y: number } | null): string {
  if (!coord) {
    return "(not provided)";
  }
  return `${coord.x}, ${coord.y}`;
}

function renderLogs(logs?: string[]): string {
  if (!logs?.length) {
    return "(No console logs)";
  }
  return logs.join("\n");
}

function ensureCoordinate(obj: unknown): { x: number; y: number } | undefined {
  if (
    !obj ||
    typeof obj !== "object" ||
    typeof (obj as any).x !== "number" ||
    typeof (obj as any).y !== "number"
  ) {
    return undefined;
  }
  return { x: (obj as any).x, y: (obj as any).y };
}

export const browserActionImpl: ToolImpl = async (args, extras) => {
  const action = getStringArg(args, "action");
  if (!ACTIONS.has(action)) {
    throw new Error(
      `Unsupported browser action "${action}". Must be one of: ${[
        ...ACTIONS,
      ].join(", ")}`,
    );
  }

  const request: BrowserActionRequest = {
    action: action as BrowserActionRequest["action"],
  };

  if (action === "launch") {
    const url = getOptionalStringArg(args, "url");
    if (!url) {
      throw new Error("Launch action requires the 'url' parameter.");
    }
    request.url = url;
  }

  if (action === "click") {
    const coordinate = ensureCoordinate(args?.coordinate);
    if (!coordinate) {
      throw new Error(
        "Click action requires 'coordinate' with numeric x and y properties.",
      );
    }
    request.coordinate = coordinate;
  }

  if (action === "type") {
    const text = getOptionalStringArg(args, "text");
    if (!text) {
      throw new Error("Type action requires the 'text' parameter.");
    }
    request.text = text;
  }

  const snapshot: BrowserSnapshot = await (extras.ide as any).browserAction(
    request,
  );

  const contextItems: ContextItem[] = [
    {
      name: "Browser",
      description: snapshot.status ?? "Browser action result",
      content: [
        request.action ? `Action: ${request.action}` : "",
        snapshot.url ? `URL: ${snapshot.url}` : "",
        snapshot.mousePosition
          ? `Mouse position: ${formatCoordinate(snapshot.mousePosition)}`
          : "",
        `Logs:\n${renderLogs(snapshot.logs)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      icon: "browser",
    },
  ];

  if (snapshot.screenshot) {
    contextItems.push({
      name: "Browser Screenshot",
      description: "Latest browser view",
      content: `![Browser screenshot](${snapshot.screenshot})`,
      icon: "image",
    });
  }

  return contextItems;
};
