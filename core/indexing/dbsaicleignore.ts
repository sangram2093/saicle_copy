import fs from "fs";
import { IDE } from "..";
import { getGlobalDbSaicleIgnorePath } from "../util/paths";
import { gitIgArrayFromFile } from "./ignore";

export const getGlobalDbSaicleIgArray = () => {
  const contents = fs.readFileSync(getGlobalDbSaicleIgnorePath(), "utf8");
  return gitIgArrayFromFile(contents);
};

export const getWorkspaceDbSaicleIgArray = async (ide: IDE) => {
  const dirs = await ide.getWorkspaceDirs();
  return await dirs.reduce(
    async (accPromise, dir) => {
      const acc = await accPromise;
      try {
        const contents = await ide.readFile(`${dir}/.dbsaicleignore`);
        return [...acc, ...gitIgArrayFromFile(contents)];
      } catch (err) {
        console.error(err);
        return acc;
      }
    },
    Promise.resolve([] as string[]),
  );
};
