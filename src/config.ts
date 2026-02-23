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
