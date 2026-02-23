# Settings Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `PluginConfig<T>` and `deepMerge` to obskit so plugins can safely evolve settings schemas with automatic deep merging and opt-in migrations.

**Architecture:** A new `src/config.ts` module exports `PluginConfig<T>` (load with migrations + deep merge) and `deepMerge` (standalone utility). The version is tracked in `data.json` as `__obskit_config_version__`. Obsidian's `Plugin` is used via dependency injection (passed to `load()`), making the code testable with simple mocks.

**Tech Stack:** TypeScript (strict mode), jest + ts-jest (new — no test framework existed), Obsidian API (peer dep, mocked in tests)

**Design doc:** `docs/plans/2026-02-23-settings-migration-design.md`

---

### Task 1: Set up vitest

The project has no test framework. Add vitest so we can TDD the implementation.

**Files:**

- Modify: `package.json` (add vitest dev dependency + test script)
- Create: `vitest.config.ts`
- Modify: `.justfile` (add test target, update preflight)
- Modify: `tsconfig.json` (exclude tests from compilation)

**Step 1: Install vitest**

Run: `npm install --save-dev vitest`

**Step 2: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        globals: true,
        include: ["tests/**/*.test.ts"],
    },
})
```

**Step 3: Add test script to package.json**

Add to `"scripts"`:

```json
"test": "vitest run"
```

**Step 4: Exclude tests from tsc compilation**

In `tsconfig.json`, add `"tests/**/*"` to the `"exclude"` array:

```json
"exclude": ["tmp/**/*", "node_modules/**/*", "dist/**/*", "plugin/**/*", "tests/**/*"]
```

**Step 5: Add test and preflight targets to .justfile**

Add a `test` recipe and update `preflight`:

```justfile
# run tests
test:
	npm test

# full preflight: build + test + check
preflight: build test
	npx prettier --check .
	npx eslint src
```

**Step 6: Create a smoke test to verify setup**

Create `tests/smoke.test.ts`:

```typescript
import { describe, it, expect } from "@jest/globals"

describe("test setup", () => {
    it("runs a basic test", () => {
        expect(1 + 1).toBe(2)
    })
})
```

**Step 7: Run tests to verify setup**

Run: `npx vitest run`
Expected: 1 test passes

**Step 8: Run full preflight**

Run: `just preflight`
Expected: Build succeeds, tests pass, lint/format pass

**Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.json .justfile tests/smoke.test.ts
git commit -m "Add vitest test framework"
```

---

### Task 2: Implement deepMerge (TDD)

The standalone deep merge utility. This is the foundation — `PluginConfig` depends on it.

**Files:**

- Create: `tests/config.test.ts`
- Create: `src/config.ts`

**Step 1: Write failing tests for deepMerge**

Create `tests/config.test.ts`:

```typescript
import { describe, it, expect } from "@jest/globals"
import { deepMerge } from "../src/config"

describe("deepMerge", () => {
    it("returns defaults when saved is empty", () => {
        const defaults = { a: 1, b: "hello" }
        const result = deepMerge(defaults, {})
        expect(result).toEqual({ a: 1, b: "hello" })
    })

    it("preserves saved values for flat objects", () => {
        const defaults = { a: 1, b: "hello" }
        const saved = { a: 42 }
        const result = deepMerge(defaults, saved)
        expect(result).toEqual({ a: 42, b: "hello" })
    })

    it("fills in missing keys in nested objects", () => {
        const defaults = { rendering: { color: "blue", size: 12 } }
        const saved = { rendering: { color: "red" } }
        const result = deepMerge(defaults, saved)
        expect(result).toEqual({ rendering: { color: "red", size: 12 } })
    })

    it("fills in entirely missing nested groups", () => {
        const defaults = { rendering: { color: "blue" }, flow: { extra: true } }
        const saved = { rendering: { color: "red" } }
        const result = deepMerge(defaults, saved)
        expect(result).toEqual({ rendering: { color: "red" }, flow: { extra: true } })
    })

    it("treats arrays as atomic values", () => {
        const defaults = { items: [1, 2, 3] }
        const saved = { items: [99] }
        const result = deepMerge(defaults, saved)
        expect(result).toEqual({ items: [99] })
    })

    it("preserves falsy values from saved data", () => {
        const defaults = { enabled: true, count: 10, name: "default", data: { a: 1 } }
        const saved = { enabled: false, count: 0, name: "", data: null }
        const result = deepMerge(defaults, saved)
        expect(result).toEqual({ enabled: false, count: 0, name: "", data: null })
    })

    it("preserves extra keys from saved data", () => {
        const defaults = { a: 1 }
        const saved = { a: 2, legacy: "old" }
        const result = deepMerge(defaults, saved)
        expect(result).toEqual({ a: 2, legacy: "old" })
    })

    it("does not mutate the defaults object", () => {
        const defaults = { rendering: { color: "blue" } }
        const saved = { rendering: { color: "red" } }
        deepMerge(defaults, saved)
        expect(defaults.rendering.color).toBe("blue")
    })

    it("does not mutate the saved object", () => {
        const defaults = { rendering: { color: "blue", size: 12 } }
        const saved = { rendering: { color: "red" } }
        deepMerge(defaults, saved)
        expect(saved).toEqual({ rendering: { color: "red" } })
    })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL — cannot import `deepMerge` from `../src/config`

**Step 3: Implement deepMerge**

Create `src/config.ts`:

```typescript
/**
 * Check if a value is a plain object (not an array, null, Date, etc.).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Date) &&
        !(value instanceof RegExp)
    )
}

/**
 * Deep merge two objects. Values from `saved` take precedence.
 * Nested objects are recursively merged. Arrays are treated as atomic.
 * Only truly missing keys in `saved` are filled from `defaults`.
 */
export function deepMerge<T extends Record<string, unknown>>(defaults: T, saved: Partial<T>): T {
    const result: Record<string, unknown> = {}

    // Start with all keys from defaults
    for (const key of Object.keys(defaults)) {
        const defaultVal = defaults[key]
        const savedVal = (saved as Record<string, unknown>)[key]

        if (!(key in (saved as Record<string, unknown>))) {
            // Key missing from saved — use default (deep clone)
            result[key] = isPlainObject(defaultVal)
                ? deepMerge(
                      defaultVal as Record<string, unknown>,
                      {} as Partial<Record<string, unknown>>
                  )
                : defaultVal
        } else if (isPlainObject(defaultVal) && isPlainObject(savedVal)) {
            // Both are plain objects — recurse
            result[key] = deepMerge(
                defaultVal as Record<string, unknown>,
                savedVal as Partial<Record<string, unknown>>
            )
        } else {
            // Saved value wins (including null, false, 0, "", arrays)
            result[key] = savedVal
        }
    }

    // Preserve extra keys from saved that aren't in defaults
    for (const key of Object.keys(saved as Record<string, unknown>)) {
        if (!(key in defaults)) {
            result[key] = (saved as Record<string, unknown>)[key]
        }
    }

    return result as T
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/config.test.ts`
Expected: All 9 tests pass

**Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "Add deepMerge utility with tests"
```

---

### Task 3: Implement PluginConfig (TDD)

The main config class that wraps deep merge with versioned migrations.

**Files:**

- Modify: `tests/config.test.ts` (add PluginConfig tests)
- Modify: `src/config.ts` (add PluginConfig class)

**Step 1: Write failing tests for PluginConfig**

Append to `tests/config.test.ts`:

```typescript
import { deepMerge, PluginConfig } from "../src/config"

// Mock Plugin — simulates Obsidian's loadData/saveData
function createMockPlugin(data: Record<string, unknown> | null = null) {
    let stored = data
    return {
        loadData: async () => structuredClone(stored),
        saveData: async (d: Record<string, unknown>) => {
            stored = structuredClone(d)
        },
        getSavedData: () => stored,
    }
}

interface TestSettings {
    name: string
    count: number
    nested: { enabled: boolean; color: string }
}

const TEST_DEFAULTS: TestSettings = {
    name: "default",
    count: 10,
    nested: { enabled: true, color: "blue" },
}

describe("PluginConfig", () => {
    it("returns defaults on first run (null data)", async () => {
        const mock = createMockPlugin(null)
        const config = new PluginConfig<TestSettings>({ defaults: TEST_DEFAULTS })

        const result = await config.load(mock as any)

        expect(result).toEqual(TEST_DEFAULTS)
    })

    it("writes defaults and version to disk on first run", async () => {
        const mock = createMockPlugin(null)
        const config = new PluginConfig<TestSettings>({ defaults: TEST_DEFAULTS })

        await config.load(mock as any)

        const saved = mock.getSavedData()
        expect(saved).toMatchObject({ ...TEST_DEFAULTS, __obskit_config_version__: 0 })
    })

    it("deep merges existing data with defaults", async () => {
        const mock = createMockPlugin({
            __obskit_config_version__: 0,
            name: "custom",
            count: 42,
            nested: { enabled: false },
        })
        const config = new PluginConfig<TestSettings>({ defaults: TEST_DEFAULTS })

        const result = await config.load(mock as any)

        expect(result).toEqual({
            name: "custom",
            count: 42,
            nested: { enabled: false, color: "blue" },
        })
    })

    it("does not save back when no migrations ran", async () => {
        const mock = createMockPlugin({
            __obskit_config_version__: 0,
            name: "custom",
            count: 42,
            nested: { enabled: false, color: "red" },
        })
        const config = new PluginConfig<TestSettings>({ defaults: TEST_DEFAULTS })

        let saveCalled = false
        mock.saveData = async () => {
            saveCalled = true
        }

        await config.load(mock as any)

        expect(saveCalled).toBe(false)
    })

    it("runs pending migrations in order", async () => {
        const order: number[] = []
        const mock = createMockPlugin({
            __obskit_config_version__: 0,
            name: "old",
            count: 10,
            nested: { enabled: true, color: "blue" },
        })
        const config = new PluginConfig<TestSettings>({
            defaults: TEST_DEFAULTS,
            migrations: [
                data => {
                    order.push(0)
                    data.name = "migrated-0"
                },
                data => {
                    order.push(1)
                    data.name = "migrated-1"
                },
            ],
        })

        const result = await config.load(mock as any)

        expect(order).toEqual([0, 1])
        expect(result.name).toBe("migrated-1")
    })

    it("skips already-applied migrations", async () => {
        const mock = createMockPlugin({
            __obskit_config_version__: 1,
            name: "already-migrated",
            count: 10,
            nested: { enabled: true, color: "blue" },
        })
        const config = new PluginConfig<TestSettings>({
            defaults: TEST_DEFAULTS,
            migrations: [
                data => {
                    data.name = "should-not-run"
                },
                data => {
                    data.name = "should-run"
                },
            ],
        })

        const result = await config.load(mock as any)

        expect(result.name).toBe("should-run")
    })

    it("saves back with updated version after migrations", async () => {
        const mock = createMockPlugin({
            __obskit_config_version__: 0,
            name: "old",
            count: 10,
            nested: { enabled: true, color: "blue" },
        })
        const config = new PluginConfig<TestSettings>({
            defaults: TEST_DEFAULTS,
            migrations: [
                data => {
                    data.name = "migrated"
                },
            ],
        })

        await config.load(mock as any)

        const saved = mock.getSavedData()
        expect(saved).toMatchObject({ __obskit_config_version__: 1, name: "migrated" })
    })

    it("treats missing version field as version 0", async () => {
        const mock = createMockPlugin({
            name: "pre-obskit",
            count: 5,
            nested: { enabled: false, color: "green" },
        })
        const config = new PluginConfig<TestSettings>({
            defaults: TEST_DEFAULTS,
            migrations: [
                data => {
                    data.name = "migrated-from-zero"
                },
            ],
        })

        const result = await config.load(mock as any)

        expect(result.name).toBe("migrated-from-zero")
    })

    it("deep merges after migrations fill in new defaults", async () => {
        interface V2Settings {
            name: string
            count: number
            nested: { enabled: boolean; color: string; size: number }
        }
        const v2Defaults: V2Settings = {
            name: "default",
            count: 10,
            nested: { enabled: true, color: "blue", size: 12 },
        }
        const mock = createMockPlugin({
            __obskit_config_version__: 0,
            name: "custom",
            count: 42,
            nested: { enabled: false, color: "red" },
        })
        const config = new PluginConfig<V2Settings>({
            defaults: v2Defaults,
            migrations: [
                () => {
                    // migration exists but doesn't touch nested.size
                },
            ],
        })

        const result = await config.load(mock as any)

        expect(result.nested.size).toBe(12)
        expect(result.nested.color).toBe("red")
    })

    it("strips __obskit_config_version__ from returned settings", async () => {
        const mock = createMockPlugin({
            __obskit_config_version__: 0,
            name: "test",
            count: 1,
            nested: { enabled: true, color: "blue" },
        })
        const config = new PluginConfig<TestSettings>({ defaults: TEST_DEFAULTS })

        const result = await config.load(mock as any)

        expect("__obskit_config_version__" in result).toBe(false)
    })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL — `PluginConfig` is not exported

**Step 3: Implement PluginConfig**

Add to `src/config.ts`:

```typescript
import { Plugin } from "obsidian"
import { Logger } from "./logger"

const VERSION_KEY = "__obskit_config_version__"

/** Migration function that mutates raw settings data in place. */
export type Migration = (data: Record<string, unknown>) => void

/** Options for creating a PluginConfig. */
export interface PluginConfigOptions<T> {
    /** The full default settings object. */
    defaults: T
    /** Optional ordered migration functions for breaking schema changes. */
    migrations?: Migration[]
}

/**
 * Manages plugin settings with automatic deep merging and versioned migrations.
 */
export class PluginConfig<T extends Record<string, unknown>> {
    private defaults: T
    private migrations: Migration[]
    private logger: Logger = Logger.getLogger("config")

    constructor(options: PluginConfigOptions<T>) {
        this.defaults = options.defaults
        this.migrations = options.migrations ?? []
    }

    /**
     * Load settings from the plugin's data store.
     *
     * Runs pending migrations, deep merges with defaults, and optionally
     * saves back if migrations were applied.
     */
    async load(plugin: Plugin): Promise<T> {
        const raw = (await plugin.loadData()) as Record<string, unknown> | null
        const saved = raw ?? {}

        // Determine current version
        const version = typeof saved[VERSION_KEY] === "number" ? (saved[VERSION_KEY] as number) : 0

        // Run pending migrations
        const migrated = version < this.migrations.length
        for (let i = version; i < this.migrations.length; i++) {
            this.logger.debug(`Running migration ${i}`)
            const migration = this.migrations[i]
            if (migration) {
                migration(saved)
            }
        }

        // Remove version key before merge so it doesn't leak into typed result
        delete saved[VERSION_KEY]

        // Deep merge defaults with saved data
        const result = deepMerge(this.defaults, saved as Partial<T>)

        // Save back if migrations ran or first run
        if (migrated || raw === null) {
            const toSave = { ...result, [VERSION_KEY]: this.migrations.length }
            await plugin.saveData(toSave)
            this.logger.debug(`Settings saved (version ${this.migrations.length})`)
        }

        return result
    }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/config.test.ts`
Expected: All tests pass (deepMerge + PluginConfig)

**Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "Add PluginConfig with versioned migrations"
```

---

### Task 4: Export from index.ts

Wire up the new module in obskit's public API.

**Files:**

- Modify: `src/index.ts`

**Step 1: Add config export**

Add to `src/index.ts`:

```typescript
export * from "./config"
```

**Step 2: Run build**

Run: `npm run build`
Expected: Compiles without errors, `dist/config.js` and `dist/config.d.ts` are generated

**Step 3: Run full preflight**

Run: `just preflight`
Expected: Build, tests, lint, format all pass

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "Export PluginConfig and deepMerge from package"
```

---

### Task 5: Update example plugin with migration demo

Show developers how to use the new API with a concrete, runnable example.

**Files:**

- Modify: `plugin/main.ts`

**Step 1: Update the settings interface**

Rename `userName` to `displayName` in the interface:

```typescript
interface ExamplePluginSettings {
    enableFeature: boolean
    displayName: string
    refreshInterval: number
    logLevel: LogLevel
    theme: string
    autoSave: boolean
    maxItems: number
}
```

**Step 2: Replace DEFAULT_SETTINGS and add config**

Replace the `DEFAULT_SETTINGS` const and add a `PluginConfig` instance:

```typescript
import { PluginConfig } from "../src/config.js"

const DEFAULT_SETTINGS: ExamplePluginSettings = {
    enableFeature: true,
    displayName: "",
    refreshInterval: 30,
    logLevel: LogLevel.INFO,
    theme: "default",
    autoSave: false,
    maxItems: 100,
}

const config = new PluginConfig<ExamplePluginSettings>({
    defaults: DEFAULT_SETTINGS,
    migrations: [
        // v0->v1: renamed userName to displayName
        data => {
            if ("userName" in data) {
                data.displayName = data.userName
                delete data.userName
            }
        },
    ],
})
```

**Step 3: Update loadSettings**

Replace the `Object.assign` pattern:

```typescript
async loadSettings() {
    this.settings = await config.load(this)
    this.applySettings()
}
```

**Step 4: Update saveSettings**

Keep it simple:

```typescript
async saveSettings() {
    await this.saveData(this.settings)
}
```

**Step 5: Update the UserNameSetting class**

Rename to `DisplayNameSetting` and update references:

```typescript
class DisplayNameSetting extends TextInputSetting {
    constructor(private plugin: ExamplePlugin) {
        super({
            name: "Display Name",
            description: "Enter your display name for personalized features.",
        })
    }

    get value(): string {
        return this.plugin.settings.displayName
    }

    set value(val: string) {
        this.plugin.settings.displayName = val
        this.plugin.saveSettings()
    }

    get default(): string {
        return ""
    }

    get placeholder(): string {
        return "Enter your display name..."
    }
}
```

**Step 6: Update GeneralSettings page**

Replace `UserNameSetting` with `DisplayNameSetting`:

```typescript
display(containerEl: HTMLElement): void {
    new EnableFeatureSetting(this.plugin).display(containerEl)
    new DisplayNameSetting(this.plugin).display(containerEl)
    new ThemeSetting(this.plugin).display(containerEl)
}
```

**Step 7: Update the reset handler in AdvancedSettings**

Change the reset handler to use `DEFAULT_SETTINGS`:

```typescript
button.onClick(async () => {
    if (confirm("Are you sure you want to reset all settings?")) {
        this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS)
        this.plugin.saveSettings()
    }
})
```

(This stays the same — `DEFAULT_SETTINGS` is still a plain const.)

**Step 8: Run preflight**

Run: `just preflight`
Expected: Build, tests, lint, format all pass

**Step 9: Commit**

```bash
git add plugin/main.ts
git commit -m "Update example plugin to use PluginConfig with migration"
```

---

### Task 6: Delete smoke test and final verification

Clean up the temporary smoke test and run full preflight.

**Files:**

- Delete: `tests/smoke.test.ts`

**Step 1: Delete smoke test**

Remove `tests/smoke.test.ts` — it was scaffolding, not a real test.

**Step 2: Run full preflight**

Run: `just preflight`
Expected: Build succeeds, all config tests pass, lint/format pass

**Step 3: Commit**

```bash
git rm tests/smoke.test.ts
git commit -m "Remove smoke test scaffolding"
```
