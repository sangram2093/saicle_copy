import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const fetchUrlChunkTool: Tool = {
  type: "function",
  displayTitle: "Read URL Chunk",
  wouldLikeTo: "fetch a chunk from {{{ url }}}",
  isCurrently: "fetching a chunk from {{{ url }}}",
  hasAlready: "fetched a chunk from {{{ url }}}",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.FetchUrlChunk,
    description:
      "Returns a chunk of content from the URL. The chunk start is specified by start_offset (which is inclusive) and chunk_length as the length of the chunk. Do NOT use this for files.",
    parameters: {
      type: "object",
      required: ["url", "start_offset", "chunk_length"],
      properties: {
        url: {
          type: "string",
          description: "The URL to read",
        },
        start_offset: {
          type: "integer",
          description: "The start offset of the chunk, inclusive",
        },
        chunk_length: {
          type: "integer",
          description: "The length of the chunk to be returned",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To fetch a chunk of content from a URL, use the ${BuiltInToolNames.FetchUrlChunk} tool. For example, to read a chunk of a webpage, you might respond with `,
    exampleArgs: [
      ["url", "https://example.com"],
      ["start_offset", "0"],
      ["chunk_length", "100"],
    ],
  },
};
