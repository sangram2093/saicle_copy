import { resolveRelativePathInDir } from "core/util/ideUtils";
import { getUriPathBasename } from "core/util/uri";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";
import {
  performFindAndReplace,
  validateSingleEdit,
} from "./findAndReplaceUtils";
import { maybeUnquoteLiteral } from "./unquote";
export const singleFindAndReplaceImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const {
    filepath,
    old_string,
    new_string,
    replace_all = false,
    editingFileContents,
    fileUri,
    baseName,
  } = args;

  const streamId = uuid();

  // Validate arguments
  if (!filepath) {
    throw new Error("filepath is required");
  }
  validateSingleEdit(old_string, new_string);

  // Resolve the file path
  let resolvedFilepath = fileUri;
  if (resolvedFilepath) {
    const exists = await extras.ideMessenger.ide.fileExists(resolvedFilepath);
    if (!exists) {
      resolvedFilepath = undefined;
    }
  }

  if (!resolvedFilepath) {
    let normalizedPath = filepath;
    if (normalizedPath?.startsWith("./") || normalizedPath?.startsWith(".\\")) {
      normalizedPath = normalizedPath.slice(2);
    }
    resolvedFilepath = await resolveRelativePathInDir(
      normalizedPath,
      extras.ideMessenger.ide,
    );
  }

  if (!resolvedFilepath) {
    const openFiles = await extras.ideMessenger.ide.getOpenFiles();
    const matches = openFiles.filter((uri) => {
      if (baseName && getUriPathBasename(uri) === baseName) {
        return true;
      }
      return filepath ? uri.endsWith(filepath) : false;
    });
    if (matches.length === 1) {
      resolvedFilepath = matches[0];
    } else if (matches.length > 1) {
      const names = matches.map((uri) => getUriPathBasename(uri)).join(", ");
      throw new Error(
        `Multiple open files match ${filepath ?? baseName}: ${names}. Provide a more specific filepath or fileUri.`,
      );
    }
  }

  if (!resolvedFilepath) {
    throw new Error(
      `File ${filepath} does not exist. Provide a workspace-relative path or fileUri.`,
    );
  }

  // Read the current file content
  const originalContent =
    editingFileContents ??
    (await extras.ideMessenger.ide.readFile(resolvedFilepath));
  const unquotedString = maybeUnquoteLiteral(originalContent);

  // Perform the find and replace operation
  const newContent = performFindAndReplace(
    unquotedString,
    old_string,
    new_string,
    replace_all,
  );

  // Apply the changes to the file
  void extras.dispatch(
    applyForEditTool({
      streamId,
      toolCallId,
      text: newContent,
      filepath: resolvedFilepath,
      isSearchAndReplace: true,
    }),
  );

  // Return success - applyToFile will handle the completion state
  return {
    respondImmediately: false, // Let apply state handle completion
    output: undefined,
  };
};
