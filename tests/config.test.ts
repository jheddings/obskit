import { describe, it, expect } from "@jest/globals"
import { deepMerge, PluginConfig } from "../src/config"

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
        const saved = { rendering: { color: "red" } } as Partial<typeof defaults>
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
        const saved = { enabled: false, count: 0, name: "", data: null } as unknown as Partial<
            typeof defaults
        >
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
        const saved = { rendering: { color: "red" } } as Partial<typeof defaults>
        deepMerge(defaults, saved)
        expect(saved).toEqual({ rendering: { color: "red" } })
    })
})

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
    [key: string]: unknown
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await config.load(mock as any)
        expect(result).toEqual(TEST_DEFAULTS)
    })

    it("writes defaults and version to disk on first run", async () => {
        const mock = createMockPlugin(null)
        const config = new PluginConfig<TestSettings>({ defaults: TEST_DEFAULTS })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await config.load(mock as any)
        expect(result.name).toBe("migrated-from-zero")
    })

    it("deep merges after migrations fill in new defaults", async () => {
        interface V2Settings {
            [key: string]: unknown
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
                    /* migration exists but doesn't touch nested.size */
                },
            ],
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await config.load(mock as any)
        expect("__obskit_config_version__" in result).toBe(false)
    })

    it("save() persists settings with version key", async () => {
        const mock = createMockPlugin(null)
        const config = new PluginConfig<TestSettings>({
            defaults: TEST_DEFAULTS,
            migrations: [
                data => {
                    data.name = "migrated"
                },
            ],
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await config.load(mock as any)

        // Simulate user changing a setting and saving
        const settings = { ...TEST_DEFAULTS, name: "user-changed" }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await config.save(mock as any, settings)

        const saved = mock.getSavedData()
        expect(saved).toMatchObject({
            name: "user-changed",
            __obskit_config_version__: 1,
        })
    })

    it("save() preserves version across load/save cycle", async () => {
        const mock = createMockPlugin(null)
        const config = new PluginConfig<TestSettings>({
            defaults: TEST_DEFAULTS,
            migrations: [
                data => {
                    data.name = "migrated"
                },
            ],
        })

        // First load — runs migration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await config.load(mock as any)

        // Save with user changes
        result.name = "user-changed"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await config.save(mock as any, result)

        // Second load — should NOT re-run migrations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result2 = await config.load(mock as any)
        expect(result2.name).toBe("user-changed") // NOT "migrated"
    })
})
