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

    /**
     * Save settings to the plugin's data store.
     *
     * Re-attaches the version key so migrations are tracked correctly.
     */
    async save(plugin: Plugin, settings: T): Promise<void> {
        const toSave = { ...settings, [VERSION_KEY]: this.migrations.length }
        await plugin.saveData(toSave)
    }
}

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
