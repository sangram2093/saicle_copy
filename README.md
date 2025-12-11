# dbSaicle

dbSaicle is an AI development companion that runs across your IDEs, terminal, and CI. This repository contains the full codebase (extensions, CLI, shared core, docs) prepared for the dbSaicle brand.

## Features
- Multi-surface assistance: IDE chat/agent panels, inline edit, autocomplete, and terminal/CI tooling.
- Extensible core with shared language models, context providers, and packaging scripts.
- VS Code and JetBrains extensions plus a CLI for local and remote workflows.
- Documentation, demos, and assets to help teams onboard quickly.

## Repo map
- `core/` – shared engine, autocomplete, and SDK utilities.
- `extensions/vscode/` – VS Code extension and E2E assets.
- `extensions/intellij/` – JetBrains plugin source and resources.
- `extensions/cli/` – CLI entrypoint and bundling scripts.
- `binary/` – build and packaging helpers for native binaries.
- `packages/` – shared packages (config, adapters, SDK, terminal security, etc.).
- `docs/` – documentation sources and images.
- `actions/` and `.github/` – CI/CD workflows and reusable GitHub Actions.

## Getting started
1. Install Node.js 20.19+ and npm.
2. Install root tooling (formatters, TypeScript helpers): `npm install`.
3. Work inside the package you need:
   - VS Code: `cd extensions/vscode && npm install && npm run build`.
   - JetBrains: `cd extensions/intellij` and follow the Gradle tasks defined there.
   - CLI: `cd extensions/cli && npm install && npm run build`.
   - Core/shared packages: install and build from their respective directories.
4. For continuous type-checking, run `npm run tsc:watch` from the repo root.

## Release and versioning
- Current baseline version: `0.0.1`. See `CHANGELOG.md` for release notes.
- Tag releases with `v<version>` (e.g., `v0.0.1`) after merging the corresponding commit.
- Keep CHANGELOG entries aligned with tags so new users can track updates quickly.

## License
Apache License 2.0. See `LICENSE` for details.
