const { exec } = require("child_process");
const fs = require("fs");

const version = JSON.parse(
  fs.readFileSync("./package.json", { encoding: "utf-8" }),
).version;

const args = process.argv.slice(2);
let target;

if (args[0] === "--target") {
  target = args[1];
}

if (!fs.existsSync("build")) {
  fs.mkdirSync("build");
}

const isPreRelease = args.includes("--pre-release");

// Stage specific runtime deps into out/node_modules so they are available at runtime.
function copyRuntimeDeps() {
  const deps = ["pdf-parse", "node-ensure", "debug"];
  for (const dep of deps) {
    const src = `node_modules/${dep}`;
    const dest = `out/node_modules/${dep}`;
    if (!fs.existsSync(src)) {
      console.warn(`[package.js] Skipping copy for ${dep} (not found in node_modules)`);
      continue;
    }
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync("out/node_modules", { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    console.log(`[package.js] Copied ${src} -> ${dest}`);
  }
}

copyRuntimeDeps();

let command = isPreRelease
  ? "npx @vscode/vsce package --out ./build --pre-release --no-dependencies" // --yarn"
  : "npx @vscode/vsce package --out ./build --no-dependencies"; // --yarn";

if (target) {
  command += ` --target ${target}`;
}

exec(command, (error) => {
  if (error) {
    throw error;
  }
  console.log(
    `vsce package completed - extension created at extensions/vscode/build/dbsaicle-${version}.vsix`,
  );
});
