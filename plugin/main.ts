// main.ts - main entry point for Obsidian Kit plugin

import { Plugin, App, Setting } from "obsidian"
import { Logger, LogLevel } from "../src/logger.js"
import {
    SettingsTabPage,
    PluginSettingsTab,
    ToggleSetting,
    TextInputSetting,
    SliderSetting,
    DropdownSetting,
} from "../src/settings.js"

interface ExamplePluginSettings {
    enableFeature: boolean
    userName: string
    refreshInterval: number
    logLevel: LogLevel
    theme: string
    autoSave: boolean
    maxItems: number
}

const DEFAULT_SETTINGS: ExamplePluginSettings = {
    enableFeature: true,
    userName: "",
    refreshInterval: 30,
    logLevel: LogLevel.INFO,
    theme: "default",
    autoSave: false,
    maxItems: 100,
}

/**
 * Example plugin class
 */
export default class ExamplePlugin extends Plugin {
    settings: ExamplePluginSettings

    private logger: Logger = Logger.getLogger("main")

    async onload() {
        await this.loadSettings()

        this.addSettingTab(new ExampleSettingsTab(this.app, this))

        this.logger.info("Plugin loaded")
    }

    async onunload() {
        this.logger.info("Plugin unloaded")
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())

        this.applySettings()
    }

    async saveSettings() {
        await this.saveData(this.settings)

        this.applySettings()
    }

    private applySettings() {
        Logger.setGlobalLogLevel(this.settings.logLevel)
    }
}

// ============================================================================
// SETTINGS CLASSES
// ============================================================================

/**
 * Toggle setting for enabling/disabling features.
 */
class EnableFeatureSetting extends ToggleSetting {
    constructor(private plugin: ExamplePlugin) {
        super({
            name: "Enable Feature",
            description: "Enable or disable the main feature of this plugin.",
        })
    }

    get value(): boolean {
        return this.plugin.settings.enableFeature
    }

    set value(val: boolean) {
        this.plugin.settings.enableFeature = val
        this.plugin.saveSettings()
    }

    get default(): boolean {
        return true
    }
}

/**
 * Text input setting for user name.
 */
class UserNameSetting extends TextInputSetting {
    constructor(private plugin: ExamplePlugin) {
        super({
            name: "User Name",
            description: "Enter your username for personalized features.",
        })
    }

    get value(): string {
        return this.plugin.settings.userName
    }

    set value(val: string) {
        this.plugin.settings.userName = val
        this.plugin.saveSettings()
    }

    get default(): string {
        return ""
    }

    get placeholder(): string {
        return "Enter your username..."
    }
}

/**
 * Slider setting for refresh interval.
 */
class RefreshIntervalSetting extends SliderSetting {
    constructor(private plugin: ExamplePlugin) {
        super({
            name: "Refresh Interval",
            description: "Set the refresh interval in seconds.",
        })
    }

    get value(): number {
        return this.plugin.settings.refreshInterval
    }

    set value(val: number) {
        this.plugin.settings.refreshInterval = val
        this.plugin.saveSettings()
    }

    get default(): number {
        return 30
    }

    get minimum(): number {
        return 5
    }

    get maximum(): number {
        return 300
    }

    get step(): number {
        return 5
    }
}

/**
 * Dropdown setting for themes.
 */
class ThemeSetting extends DropdownSetting<string> {
    constructor(private plugin: ExamplePlugin) {
        super({
            name: "Theme",
            description: "Choose your preferred theme.",
        })
    }

    get value(): string {
        return this.plugin.settings.theme
    }

    set value(val: string) {
        this.plugin.settings.theme = val
        this.plugin.saveSettings()
    }

    get default(): string {
        return "default"
    }

    get options(): { key: string; label: string; value: string }[] {
        return [
            { key: "default", label: "Default", value: "default" },
            { key: "dark", label: "Dark", value: "dark" },
            { key: "light", label: "Light", value: "light" },
            { key: "custom", label: "Custom", value: "custom" },
        ]
    }
}

/**
 * Toggle setting for auto-save.
 */
class AutoSaveSetting extends ToggleSetting {
    constructor(private plugin: ExamplePlugin) {
        super({
            name: "Auto Save",
            description: "Automatically save changes without prompting.",
        })
    }

    get value(): boolean {
        return this.plugin.settings.autoSave
    }

    set value(val: boolean) {
        this.plugin.settings.autoSave = val
        this.plugin.saveSettings()
    }

    get default(): boolean {
        return false
    }
}

/**
 * Slider setting for maximum items.
 */
class MaxItemsSetting extends SliderSetting {
    constructor(private plugin: ExamplePlugin) {
        super({
            name: "Maximum Items",
            description: "Set the maximum number of items to display.",
        })
    }

    get value(): number {
        return this.plugin.settings.maxItems
    }

    set value(val: number) {
        this.plugin.settings.maxItems = val
        this.plugin.saveSettings()
    }

    get default(): number {
        return 100
    }

    get minimum(): number {
        return 10
    }

    get maximum(): number {
        return 1000
    }

    get step(): number {
        return 10
    }
}

/**
 * Dropdown setting for log levels.
 */
class LogLevelSetting extends DropdownSetting<LogLevel> {
    constructor(private plugin: ExamplePlugin) {
        super({
            name: "Log Level",
            description: "Set the logging level for console output.",
        })
    }

    get value(): LogLevel {
        return this.plugin.settings.logLevel
    }

    set value(val: LogLevel) {
        this.plugin.settings.logLevel = val
        this.plugin.saveSettings()
    }

    get default(): LogLevel {
        return LogLevel.INFO
    }

    get options(): { key: string; label: string; value: LogLevel }[] {
        return [
            { key: "debug", label: "Debug", value: LogLevel.DEBUG },
            { key: "info", label: "Info", value: LogLevel.INFO },
            { key: "warn", label: "Warn", value: LogLevel.WARN },
            { key: "error", label: "Error", value: LogLevel.ERROR },
            { key: "silent", label: "Silent", value: LogLevel.SILENT },
        ]
    }
}

// ============================================================================
// SETTINGS PAGES
// ============================================================================

/**
 * General settings page with basic configuration options.
 */
class GeneralSettings extends SettingsTabPage {
    constructor(private plugin: ExamplePlugin) {
        super("General")
    }

    display(containerEl: HTMLElement): void {
        new EnableFeatureSetting(this.plugin).display(containerEl)
        new UserNameSetting(this.plugin).display(containerEl)
        new ThemeSetting(this.plugin).display(containerEl)
    }
}

/**
 * Performance settings page with performance-related options.
 */
class PerformanceSettings extends SettingsTabPage {
    constructor(private plugin: ExamplePlugin) {
        super("Performance")
    }

    display(containerEl: HTMLElement): void {
        new RefreshIntervalSetting(this.plugin).display(containerEl)
        new MaxItemsSetting(this.plugin).display(containerEl)
        new AutoSaveSetting(this.plugin).display(containerEl)
    }
}

/**
 * Advanced settings page with developer and debugging options.
 */
class AdvancedSettings extends SettingsTabPage {
    constructor(private plugin: ExamplePlugin) {
        super("Advanced")
    }

    display(containerEl: HTMLElement): void {
        // Add standard settings
        new LogLevelSetting(this.plugin).display(containerEl)

        // Custom settings are still supported
        new Setting(containerEl)
            .setName("Reset Settings")
            .setDesc("Reset all settings to their default values.")
            .addButton(button => {
                button.setButtonText("Reset")
                button.setWarning()
                button.onClick(async () => {
                    if (confirm("Are you sure you want to reset all settings?")) {
                        this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS)
                        this.plugin.saveSettings()
                    }
                })
            })
    }

    onActivate(): void {
        console.log("Advanced settings tab activated")
    }

    onDeactivate(): void {
        console.log("Advanced settings tab deactivated")
    }
}

// ============================================================================
// MAIN SETTINGS TAB
// ============================================================================

/**
 * Main settings tab that uses the framework.
 */
export class ExampleSettingsTab extends PluginSettingsTab {
    constructor(app: App, plugin: ExamplePlugin) {
        super(app, plugin)

        this.addTabs([
            new GeneralSettings(plugin),
            new PerformanceSettings(plugin),
            new AdvancedSettings(plugin),
        ])

        // Alternative: Add tabs individually using method chaining
        // this.addTab(new GeneralSettings(this.examplePlugin))
        //     .addTab(new PerformanceSettings(this.examplePlugin))
        //     .addTab(new AdvancedSettings(this.examplePlugin))
    }
}
