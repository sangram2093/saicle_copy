import { ContextItem } from "../..";
import { ToolImpl } from ".";
import { BuiltInToolNames } from "../builtIn";
import { getOptionalStringArg, getStringArg } from "../parseArgs";
import { toCanonicalGraph, generatePlantuml, generatePlantumlDiff } from "./plantumlHelpers";

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

  const newObj = typeof newGraphJson === "string" ? JSON.parse(newGraphJson) : newGraphJson;
  const oldObj =
    oldGraphJson && typeof oldGraphJson === "string"
      ? JSON.parse(oldGraphJson)
      : oldGraphJson
      ? oldGraphJson
      : undefined;

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
