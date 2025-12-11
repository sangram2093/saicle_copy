#!/usr/bin/env node

import * as esbuild from "esbuild";
import { chmodSync, copyFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Native-only deps that must stay external
const external = [
  "@sentry/profiling-node",
  "fsevents",
  "./xhr-sync-worker.js",
];

console.log("Building CLI with esbuild...");

// Stub optional react-devtools-core
const optionalDevtoolsPlugin = {
  name: "optional-devtools",
  setup(build) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => {
      return { path: resolve(__dirname, "stubs/react-devtools-core.js") };
    });
  },
};

try {
  const result = await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    format: "esm",
    outfile: "dist/index.js",
    external,
    sourcemap: true,
    minify: true,
    metafile: true,
    plugins: [optionalDevtoolsPlugin],

    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],

    alias: {
      "@dbsaicledev/config-yaml": resolve(
        __dirname,
        "../../packages/config-yaml/dist/index.js",
      ),
      "@dbsaicledev/openai-adapters": resolve(
        __dirname,
        "../../packages/openai-adapters/dist/index.js",
      ),
      "@dbsaicledev/config-types": resolve(
        __dirname,
        "../../packages/config-types/dist/index.js",
      ),
      core: resolve(__dirname, "../../core"),
      "@dbsaicledev/fetch": resolve(
        __dirname,
        "../../packages/fetch/dist/index.js",
      ),
      "@dbsaicledev/llm-info": resolve(
        __dirname,
        "../../packages/llm-info/dist/index.js",
      ),
      "@dbsaicledev/terminal-security": resolve(
        __dirname,
        "../../packages/terminal-security/dist/index.js",
      ),
    },

    banner: {
      js: `import { createRequire } from 'module';
const require = createRequire(import.meta.url);`,
    },
  });

  writeFileSync("dist/meta.json", JSON.stringify(result.metafile, null, 2));

  const workerSource = resolve(
    __dirname,
    "node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js",
  );
  const workerDest = resolve(__dirname, "dist/xhr-sync-worker.js");
  try {
    copyFileSync(workerSource, workerDest);
    console.log("Copied xhr-sync-worker.js");
  } catch (error) {
    console.warn("Warning: Could not copy xhr-sync-worker.js:", error.message);
  }

  writeFileSync("dist/cn.js", "#!/usr/bin/env node\nimport('./index.js');");
  chmodSync("dist/cn.js", 0o755);

  const bundleSize = result.metafile.outputs["dist/index.js"].bytes;
  console.log(
    `Build complete! Bundle size: ${(bundleSize / 1024 / 1024).toFixed(2)} MB`,
  );
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
