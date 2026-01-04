import {
  inferResolvedUriFromRelativePath,
  resolveRelativePathInDir,
} from "core/util/ideUtils";
import { getUriPathBasename } from "core/util/uri";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";
import {
  performFindAndReplace,
  validateCreatingForMultiEdit,
  validateSingleEdit,
} from "./findAndReplaceUtils";
import { maybeUnquoteLiteral } from "./unquote";
export const multiEditImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const {
    filepath,
    edits,
    editingFileContents,
    fileUri: fileUriArg,
    baseName,
  } = args;

  const streamId = uuid();

  // Validate arguments
  if (!filepath) {
    throw new Error("filepath is required");
  }
  if (!edits || !Array.isArray(edits) || edits.length === 0) {
    throw new Error(
      "edits array is required and must contain at least one edit",
    );
  }

  // Validate each edit operation
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    validateSingleEdit(edit.old_string, edit.new_string, i);
  }

  // Check if this is creating a new file (first edit has empty old_string)
  const isCreatingNewFile = validateCreatingForMultiEdit(edits);
  let resolvedUri = fileUriArg;
  if (resolvedUri) {
    const exists = await extras.ideMessenger.ide.fileExists(resolvedUri);
    if (!exists) {
      resolvedUri = undefined;
    }
  }

  if (!resolvedUri) {
    resolvedUri = await resolveRelativePathInDir(
      filepath,
      extras.ideMessenger.ide,
    );
  }

  if (!resolvedUri && !isCreatingNewFile) {
    const openFiles = await extras.ideMessenger.ide.getOpenFiles();
    const matches = openFiles.filter((uri) => {
      if (baseName && getUriPathBasename(uri) === baseName) {
        return true;
      }
      return filepath ? uri.endsWith(filepath) : false;
    });
    if (matches.length === 1) {
      resolvedUri = matches[0];
    } else if (matches.length > 1) {
      const names = matches.map((uri) => getUriPathBasename(uri)).join(", ");
      throw new Error(
        `Multiple open files match ${filepath ?? baseName}: ${names}. Provide a more specific filepath or fileUri.`,
      );
    }
  }

  let newContent: string;
  let fileUri: string;
  if (isCreatingNewFile) {
    if (resolvedUri) {
      throw new Error(
        `file ${filepath} already exists, cannot create new file`,
      );
    }
    newContent = edits[0].new_string;
    const dirs = await extras.ideMessenger.ide.getWorkspaceDirs();
    fileUri = await inferResolvedUriFromRelativePath(
      filepath,
      extras.ideMessenger.ide,
      dirs,
    );
  } else {
    if (!resolvedUri) {
      throw new Error(
        `file ${filepath} does not exist. If you are trying to edit it, correct the filepath. If you are trying to create it, you must pass old_string=""`,
      );
    }
    newContent =
      editingFileContents ??
      (await extras.ideMessenger.ide.readFile(resolvedUri));
    newContent = maybeUnquoteLiteral(newContent);
    fileUri = resolvedUri;
    for (let i = 0; i < edits.length; i++) {
      const { old_string, new_string, replace_all } = edits[i];
      newContent = performFindAndReplace(
        newContent,
        old_string,
        new_string,
        replace_all,
        i,
      );
    }
  }

  // Apply the changes to the file
  void extras.dispatch(
    applyForEditTool({
      streamId,
      toolCallId,
      text: newContent,
      filepath: fileUri,
      isSearchAndReplace: true,
    }),
  );

  // Return success - applyToFile will handle the completion state
  return {
    respondImmediately: false, // Let apply state handle completion
    output: undefined,
  };
};
