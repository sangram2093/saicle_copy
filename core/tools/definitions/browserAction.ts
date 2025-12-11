import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

const ACTION_DESCRIPTION = `- The sequence must start with a \`launch\` and end with a \`close\`. Launching a different URL requires closing the current session first.
- Only one action is permitted per tool call. Wait for the returned screenshot/logs before issuing the next action.
- Click coordinates must be provided in pixels within the current viewport (default 900x600) and should target the center of the desired element.
- Use \`scroll_down\`/\`scroll_up\` to move roughly one viewport height.
- Use \`refresh\` sparingly, only when the page fails to load or you need to fetch updated content.
- When providing text for \`type\`, include exactly what should be typed (the assistant will simulate keystrokes).`;

export const browserActionTool: Tool = {
  type: "function",
  displayTitle: "Browser Action",
  wouldLikeTo: "control the embedded browser:",
  isCurrently: "controlling the embedded browser:",
  hasAlready: "controlled the embedded browser:",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.BrowserAction,
    description: `Interact with the DbSaicle browser panel (launch, click, type, scroll, refresh, close). ${ACTION_DESCRIPTION}`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          description:
            "The action to perform. Must be one of launch, click, type, scroll_down, scroll_up, refresh, close.",
          enum: [
            "launch",
            "click",
            "type",
            "scroll_down",
            "scroll_up",
            "refresh",
            "close",
          ],
        },
        url: {
          type: "string",
          description:
            "URL to open when action is launch. Must include protocol, e.g. http://localhost:3000.",
        },
        coordinate: {
          type: "object",
          description:
            "Pixel coordinates for click actions (measured from top-left of the viewport).",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
        },
        text: {
          type: "string",
          description: "Exact text to type for the type action.",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `Use the ${BuiltInToolNames.BrowserAction} tool to launch and control the browser panel. ${ACTION_DESCRIPTION}
For example, to launch a site you could respond with:`,
    exampleArgs: [
      ["action", "launch"],
      ["url", "http://localhost:3000"],
    ],
  },
};
