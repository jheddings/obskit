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
