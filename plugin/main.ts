// main.ts - main entry point for Obsidian Kit plugin

import { Plugin } from "obsidian"
import { Logger, LogLevel } from "../src/logger"
import { PluginSettingTab, App } from "obsidian"
import { DropdownSetting } from "../src/settings"

export interface ExamplePluginSettings {
    logLevel: LogLevel
}

const DEFAULT_SETTINGS: ExamplePluginSettings = {
    logLevel: LogLevel.ERROR,
}

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

/**
 * Control the log level user setting.
 */
class LogLevelSetting extends DropdownSetting<LogLevel> {
    constructor(private plugin: ExamplePlugin) {
        super({
            name: "Log level",
            description: "Set the logging level for console output.",
        })
    }

    get value(): LogLevel {
        return this.plugin.settings.logLevel ?? this.default
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

/**
 * Settings tab for the example plugin.
 */
export class ExampleSettingsTab extends PluginSettingTab {
    private plugin: ExamplePlugin

    constructor(app: App, plugin: ExamplePlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    /**
     * Displays the settings tab UI.
     */
    display(): void {
        const { containerEl } = this
        containerEl.empty()

        new LogLevelSetting(this.plugin).display(containerEl)
    }
}
