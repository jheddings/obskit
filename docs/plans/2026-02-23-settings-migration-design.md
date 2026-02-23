# Settings Migration Design

**Date:** 2026-02-23
**Status:** Approved
**Motivation:** [obsidian-chopro#233](https://github.com/jheddings/obsidian-chopro/issues/233) — shallow `Object.assign` loses new default values for nested settings when users upgrade plugins.

## Problem

Obsidian plugins persist settings to `data.json` via `loadData()`/`saveData()`. The standard loading pattern is:

```typescript
this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
```

This performs a shallow merge. When settings have nested objects (e.g., `rendering`, `flow`), the saved object entirely replaces the default — losing any new keys added in later versions. Every plugin using this pattern (chopro, stomp, the obskit example) has this bug.

Beyond missing defaults, there is no mechanism for handling breaking schema changes (renames, restructuring, removals) between plugin versions.

## Solution

Add a `PluginConfig<T>` class and a `deepMerge` utility to obskit.

### Approach: Deep merge + opt-in migrations

- **Deep merge** runs automatically on every load, filling in new default values at any nesting depth. This solves the common case (adding new settings) with zero developer effort.
- **Migrations** are an optional ordered array of functions for breaking changes (renames, restructuring, removals). The array index is the version — obskit tracks which migrations have been applied via a `__obskit_config_version__` field in `data.json`.

## API

### PluginConfig\<T\>

```typescript
const config = new PluginConfig<MySettings>({
    defaults: DEFAULT_SETTINGS,
    migrations: [
        // v0->v1: renamed colorScheme to theme
        data => {
            data.theme = data.colorScheme
            delete data.colorScheme
        },
    ],
})
```

**Constructor options:**

- `defaults: T` — the full default settings object
- `migrations?: Array<(data: any) => void>` — optional ordered migration functions

**Methods:**

- `async load(plugin: Plugin): Promise<T>` — loads, migrates, deep merges, returns typed settings

### deepMerge

```typescript
function deepMerge<T>(defaults: T, saved: Partial<T>): T
```

Exported as a standalone utility for developers who want just the merge without migrations.

### Plugin usage

```typescript
const config = new PluginConfig<ExamplePluginSettings>({
    defaults: DEFAULT_SETTINGS,
    migrations: [
        data => {
            data.displayName = data.userName
            delete data.userName
        },
    ],
})

export default class ExamplePlugin extends Plugin {
    settings: ExamplePluginSettings

    async loadSettings() {
        this.settings = await config.load(this)
        this.applySettings()
    }

    async saveSettings() {
        await this.saveData(this.settings)
    }
}
```

## Load Sequence

`load(plugin)` performs these steps in order:

1. **Read** — call `plugin.loadData()` to get raw saved data (or `null` for first run)
2. **Migrate** — read `__obskit_config_version__` from saved data (default `0` if missing). Run migrations from that index forward. Each migration mutates the data in place.
3. **Deep merge** — deep merge defaults with the (possibly migrated) saved data. Saved values always win.
4. **Save back** (conditional) — if any migrations ran, write the merged result plus updated `__obskit_config_version__` back to disk via `plugin.saveData()`. This ensures migrations are never re-run.

Return the merged result as `T` (without the version metadata).

### Scenarios

**First install (no data.json):**

- `loadData()` returns `null`
- Migrations: skipped (nothing to migrate)
- Deep merge: defaults win entirely
- Save back: yes (writes defaults + `__obskit_config_version__` to disk)

**Existing user, no migrations pending:**

- `loadData()` returns `{ __obskit_config_version__: 2, ... }`
- Migrations: skipped (version matches `migrations.length`)
- Deep merge: fills in any new default fields
- Save back: no

**Existing user, migrations pending:**

- `loadData()` returns `{ __obskit_config_version__: 0, colorScheme: "dark", ... }`
- Migrations: runs `[0]` and `[1]`
- Deep merge: fills in new defaults
- Save back: yes (persists migrated data + `__obskit_config_version__: 2`)

**Existing user adopting PluginConfig for the first time:**

- `loadData()` returns `{ enableFeature: false, ... }` (no version field)
- Missing version treated as `0`
- If migrations array is empty (typical at adoption), no migrations run
- Deep merge fills in any new defaults
- Save back: yes (writes `__obskit_config_version__: 0`)

## Deep Merge Rules

- **Nested objects**: Recursively merged. New default keys are added; existing user values are preserved.
- **Arrays**: Atomic — user's saved array replaces the default entirely. No concatenation or element-level merging.
- **Falsy values**: User values win even if `null`, `0`, `false`, or `""`. Only truly missing keys (not present in saved data) get filled from defaults.
- **Extra keys in saved data**: Preserved. Keys not in defaults pass through silently (invisible to typed plugin code, but remain in `data.json`).

### Example

```
defaults:                          saved data.json:
{                                  {
  rendering: {                       rendering: {
    chordColor: "#2563eb",             chordColor: "#ff0000",
    showHeader: false,                 // showHeader missing
  },                                 },
  flow: {                            // flow missing entirely
    filesFolder: "",
    extraLine: true,
  },
  logLevel: "ERROR",                 logLevel: "INFO",
}                                  }

result after deep merge:
{
  rendering: {
    chordColor: "#ff0000",     // user's value preserved
    showHeader: false,         // new default filled in
  },
  flow: {
    filesFolder: "",           // entire default group filled in
    extraLine: true,
  },
  logLevel: "INFO",            // user's value preserved
}
```

## Exports

obskit adds two public exports:

- **`PluginConfig<T>`** — the config class (constructor + `load()`)
- **`deepMerge<T>(defaults, saved)`** — standalone deep merge utility

## Testing Strategy

Tests require a mock for Obsidian's `Plugin` with `loadData()` and `saveData()` stubs.

### Deep merge tests

- Flat objects merge correctly
- Nested objects fill in missing keys without overwriting existing ones
- Arrays are atomic (user's array replaces default)
- Falsy values (`false`, `0`, `""`, `null`) are preserved
- Missing top-level groups filled in entirely from defaults
- Extra keys in saved data are preserved

### PluginConfig.load() tests

- First run (null data) — returns defaults, writes version to disk
- Existing data, no migrations — deep merges, no save-back
- Existing data, pending migrations — runs migrations in order, deep merges, saves back
- Missing version field — treated as version 0
- Migrations mutate data before deep merge runs

### Migration ordering tests

- Only migrations after current version are run
- Migrations run in array order
- After migration, version is set to `migrations.length`

## Example Plugin Changes

Update `plugin/main.ts` to demonstrate the new API with a trivial migration (rename `userName` to `displayName`). This gives plugin developers a concrete, runnable reference.
