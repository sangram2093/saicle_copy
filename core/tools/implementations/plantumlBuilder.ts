import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getOptionalStringArg, getStringArg } from "../parseArgs";
import { toCanonicalGraph, generatePlantuml, generatePlantumlDiff } from "./plantumlHelpers";
import { parseGraphFromMarkdown } from "./extractEntitiesHelpers";

type PlantumlBuilderArgs = {
  newGraphJson: string;
  oldGraphJson?: string;
  title?: string;
  scale?: string;
};

export const plantumlBuilderImpl: ToolImpl = async (
  args: PlantumlBuilderArgs,
  extras,
) => {
  const newGraphJson = getStringArg(args, "newGraphJson");
  const oldGraphJson = getOptionalStringArg(args, "oldGraphJson");
  const title = getOptionalStringArg(args, "title");
  const scale = getOptionalStringArg(args, "scale");

  const newObj = parseGraphInput(newGraphJson);
  const oldObj = oldGraphJson ? parseGraphInput(oldGraphJson) : undefined;

  const newCanonical = toCanonicalGraph(newObj);
  const oldCanonical = oldObj ? toCanonicalGraph(oldObj) : undefined;

  const plantumlNew = generatePlantuml(newCanonical, title, scale);
  const plantumlDiff =
    oldCanonical && generatePlantumlDiff(oldCanonical, newCanonical, title, scale);

  const contextItems: ContextItem[] = [
    {
      name: "PlantUML (new)",
      description: "Graph for new data",
      content: `\`\`\`plantuml\n${plantumlNew}\n\`\`\``,
    },
  ];

  if (plantumlDiff) {
    contextItems.push({
      name: "PlantUML (diff)",
      description: "Diff graph (common gray, new green, removed red)",
      content: `\`\`\`plantuml\n${plantumlDiff}\n\`\`\``,
    });
  }

  return contextItems;
};

function parseGraphInput(input: string) {
  // Prefer markdown parsing; fallback to JSON if needed
  try {
    const parsed = parseGraphFromMarkdown(input);
    if (parsed.entities.length || parsed.relationships.length) {
      return parsed;
    }
  } catch {}
  try {
    return JSON.parse(input);
  } catch {
    throw new Error("Failed to parse graph input as markdown or JSON.");
  }
}
