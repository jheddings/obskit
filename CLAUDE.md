# CLAUDE.md — obskit

## Overview

obskit is a shared utility library for Obsidian plugins, providing reusable
components like `Logger`, `SettingsTabPage`, and typed setting controls.

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`

Scope is optional but encouraged (e.g. `fix(logger): ...`, `feat(settings): ...`).

Include the issue number when applicable (e.g. `feat: add toggle control (#5)`).

## Branch Naming

Use the same type prefixes as commits, followed by a short description:

```
<type>/<short-description>
```

Examples: `feat/toggle-control`, `fix/settings-tab`, `chore/update-deps`
