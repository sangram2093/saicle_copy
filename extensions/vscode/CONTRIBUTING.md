# DbSaicle VS Code Extension

This is the DbSaicle VS Code Extension. Its primary jobs are

1. Implement the IDE side of the DbSaicle IDE protocol, allowing a DbSaicle server to interact natively in an IDE. This happens in `src/dbsaicleIdeClient.ts`.
2. Open the DbSaicle React app in a side panel. The React app's source code lives in the `gui` directory. The panel is opened by the `dbsaicle.openDbSaicleGUI` command, as defined in `src/commands.ts`.

# How to run the extension

See [Environment Setup](../../CONTRIBUTING.md#environment-setup)

# How to run and debug tests

After following the setup in [Environment Setup](../../CONTRIBUTING.md#environment-setup) you can run the `Extension (VSCode)` launch configuration in VS Code.
