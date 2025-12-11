# DbSaicle JetBrains Extension

## Project Purpose

JetBrains/IntelliJ extension for DbSaicle AI code agent. Provides chat, autocomplete, inline edit, and agent features within JetBrains IDEs.

## Architecture

- **Language**: Kotlin (JDK 17), Gradle build
- **Communication**: stdin/stdout message passing with core binary from `../../binary`
- **UI**: Embeds React webview from `../../gui`
- **Platform**: IntelliJ Platform Plugin (IDEA, PyCharm, WebStorm, etc.)

## Key Source Structure

```
src/main/kotlin/com/github/dbsaicledev/dbsaicleintellijextension/
â”œâ”€â”€ dbsaicle/         # Core integration (CoreMessenger, IntelliJIde, IdeProtocolClient)
â”œâ”€â”€ autocomplete/     # Code completion logic
â”œâ”€â”€ editor/          # Diff handling, inline edits
â”œâ”€â”€ toolWindow/      # Main UI panel
â”œâ”€â”€ services/        # Settings, plugin lifecycle
â”œâ”€â”€ actions/         # Keyboard shortcuts, menu actions
â”œâ”€â”€ protocol/        # Message type definitions
â””â”€â”€ constants/       # App constants, paths

src/main/resources/
â”œâ”€â”€ META-INF/plugin.xml  # Plugin configuration
â””â”€â”€ webview/            # Embedded React UI assets
```

## Core Files

- `IntelliJIde.kt`: Main IDE interface implementation
- `CoreMessenger.kt`: Binary communication handler
- `plugin.xml`: Plugin manifest and extension points
- `build.gradle.kts`: Build configuration
- `DbSaiclePluginService.kt`: Main service orchestrator

## Message Protocol

JSON messages between Extension â†” Core â†” GUI. Message types in `constants/MessageTypes.kt`. Extension relays messages between core binary and webview.

## Testing

- Unit tests: `src/test/kotlin/`
- E2E tests: UI automation with intellij-ui-test-robot
- Test command: `./gradlew test`
- Debug: `runIde` Gradle task

## Key Integration Points

- File operations via IntelliJ VFS
- Editor integration for diffs/autocomplete
- Git operations for repository context
- Settings via IntelliJ platform storage
