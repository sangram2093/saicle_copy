import { ToolImpl } from ".";
import { getUrlContextItems } from "../../context/providers/URLContextProvider";
import { getNumberArg, getStringArg } from "../parseArgs";

export const fetchUrlChunkImpl: ToolImpl = async (args, extras) => {
  const url = getStringArg(args, "url");
  const startOffset = getNumberArg(args, "start_offset");
  const chunkLength = getNumberArg(args, "chunk_length");

  const contextItems = await getUrlContextItems(url, extras.fetch);

  if (contextItems.length === 0) {
    return [
      {
        name: "Error",
        description: "",
        content: `Could not fetch content from URL ${url}`,
      },
    ];
  }

  const content = contextItems[0].content;

  if (startOffset < 0 || startOffset >= content.length) {
    return [
      {
        name: "Error",
        description: "",
        content: `start offset (${startOffset}) is either negative or greater than the length of the content (${content.length})`,
      },
    ];
  }

  const actualEndOffset = Math.min(startOffset + chunkLength, content.length);
  const returnedChunk = content.substring(startOffset, actualEndOffset);
  const returnedChunkLength = returnedChunk.length;
  return [
    {
      name: "URL Chunk",
      description: `Chunk from ${url}`,
      content: returnedChunk,
    },
    {
      name: "Start Offset",
      description: "",
      content: startOffset.toString(),
    },
    {
      name: "Chunk Length",
      description: "",
      content: returnedChunkLength.toString(),
    },
  ];
};
