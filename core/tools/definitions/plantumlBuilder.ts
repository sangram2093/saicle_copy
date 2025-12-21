import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const plantumlBuilderTool: Tool = {
  type: "function",
  displayTitle: "PlantUML Builder",
  wouldLikeTo: "build PlantUML diagrams from entity graphs",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.PlantumlBuilder,
    description:
      "Create PlantUML diagrams (new and optional diff) from entity/relationship JSON.",
    parameters: {
      type: "object",
      required: ["newGraphJson"],
      properties: {
        newGraphJson: {
          type: "string",
          description: "Entity/relationship JSON for the new graph.",
        },
        oldGraphJson: {
          type: "string",
          description: "Optional entity/relationship JSON for the old graph to produce a diff.",
        },
        title: {
          type: "string",
          description: "Optional title for the diagram.",
        },
        scale: {
          type: "string",
          description:
            "PlantUML scale directive (default PLANTUML_SCALE env or 'max 1600*900').",
        },
      },
    },
  },
};
