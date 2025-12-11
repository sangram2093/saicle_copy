import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";
export const editToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  if (!args.filepath || !args.changes) {
    throw new Error(
      "`filepath` and `changes` arguments are required to edit an existing file.",
    );
  }
  if (typeof args.changes !== "string") {
    throw new Error("`changes` must be provided as a string.");
  }
  let filepath = args.filepath;
  if (filepath.startsWith("./")) {
    filepath = filepath.slice(2);
  }

  let firstUriMatch = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );

  if (!firstUriMatch) {
    const openFiles = await extras.ideMessenger.ide.getOpenFiles();
    for (const uri of openFiles) {
      if (uri.endsWith(filepath)) {
        firstUriMatch = uri;
        break;
      }
    }
  }

  if (!firstUriMatch) {
    throw new Error(`${filepath} does not exist`);
  }
  const streamId = uuid();
  // unquote, since we are expecting full file and none of known files start and end with quote this must be error.
  let textToTest = args?.changes;

  const unquotedText =
    textToTest?.startsWith('"') &&
    textToTest?.endsWith('"') &&
    /\\n|\\r|\\t|\\"|\\\\/.test(textToTest)
      ? textToTest
          .slice(1, -1)
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
      : textToTest;
  void extras.dispatch(
    applyForEditTool({
      streamId,
      text: unquotedText,
      toolCallId,
      isSearchAndReplace: true,
      filepath: firstUriMatch,
    }),
  );

  return {
    respondImmediately: false,
    output: undefined, // no immediate output - output for edit tools should be added based on apply state coming in
  };
};
