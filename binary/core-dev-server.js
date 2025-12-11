const path = require("path");
process.env.DBSAICLE_DEVELOPMENT = true;

process.env.DBSAICLE_GLOBAL_DIR = path.join(
  process.env.PROJECT_DIR,
  "extensions",
  ".dbsaicle-debug",
);

require("./out/index.js");
