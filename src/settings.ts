import { Plugin, Setting, PluginSettingTab, App } from "obsidian"

/** Configuration for a setting element. */
interface SettingConfig {
    name: string | DocumentFragment
    description: string
}

/**
 * Base class for reusable setting elements.
 */
abstract class BaseSetting<T> {
    protected name: string | DocumentFragment
    protected description: string

    protected _onChange?: (value: T) => void

    constructor(config: SettingConfig) {
        this.name = config.name
        this.description = config.description
    }

    abstract get value(): T

    abstract set value(val: T)

    abstract get default(): T

    /**
     * Creates the setting element in the provided container.
     */
    abstract display(containerEl: HTMLElement): Setting

    /**
     * Set the callback when the setting value changes.
     */
    onChange(callback: (value: T) => void): BaseSetting<T> {
        this._onChange = callback
        return this
    }
}

/**
 * Toggle setting for boolean values.
 */
export abstract class ToggleSetting extends BaseSetting<boolean> {
    display(containerEl: HTMLElement): Setting {
        return new Setting(containerEl)
            .setName(this.name)
            .setDesc(this.description)
            .addToggle(toggle => {
                toggle.setValue(this.value)
                toggle.onChange(async value => {
                    this.value = value
                    this._onChange?.(this.value)
                })
            })
    }
}

/**
 * Slider setting for numeric values.
 */
export abstract class SliderSetting extends BaseSetting<number> {
    display(containerEl: HTMLElement): Setting {
        return new Setting(containerEl)
            .setName(this.name)
            .setDesc(this.description)
            .addSlider(slider => {
                slider.setLimits(this.minimum, this.maximum, this.step)
                slider.setDynamicTooltip()
                slider.setValue(this.value)
                slider.onChange(async value => {
                    this.value = value
                    this._onChange?.(this.value)
                })
            })
    }

    abstract get minimum(): number

    abstract get maximum(): number

    abstract get step(): number
}

/**
 * Text input setting for single-line input.
 */
export abstract class TextInputSetting extends BaseSetting<string> {
    display(containerEl: HTMLElement): Setting {
        return new Setting(containerEl)
            .setName(this.name)
            .setDesc(this.description)
            .addText(text => {
                text.setValue(this.value)

                if (this.placeholder) {
                    text.setPlaceholder(this.placeholder)
                }

                text.onChange(async value => {
                    this.value = value
                    this._onChange?.(this.value)
                })
            })
    }

    get placeholder(): string | null {
        return null
    }
}

/**
 * Text area setting for multi-line input.
 */
export abstract class TextAreaSetting extends BaseSetting<string> {
    display(containerEl: HTMLElement): Setting {
        return new Setting(containerEl)
            .setName(this.name)
            .setDesc(this.description)
            .addTextArea(textArea => {
                textArea.setValue(this.value)

                if (this.placeholder) {
                    textArea.setPlaceholder(this.placeholder)
                }

                textArea.onChange(async value => {
                    this.value = value
                    this._onChange?.(this.value)
                })
            })
    }

    get placeholder(): string | null {
        return null
    }
}

/**
 * Dropdown setting for enumerated values.
 */
export abstract class DropdownSetting<T> extends BaseSetting<T> {
    display(containerEl: HTMLElement): Setting {
        return new Setting(containerEl)
            .setName(this.name)
            .setDesc(this.description)
            .addDropdown(dropdown => {
                this.options.forEach(({ key, label }) => {
                    dropdown.addOption(key, label)
                })
                dropdown.setValue(this.getKeyForValue(this.value))
                dropdown.onChange(async key => {
                    this.value = this.getValueForKey(key)
                    this._onChange?.(this.value)
                })
            })
    }

    abstract get options(): { key: string; label: string; value: T }[]

    /**
     * Get the key for a given value.
     */
    protected getKeyForValue(value: T): string {
        const option = this.options.find(opt => opt.value === value)
        return option?.key ?? this.options[0]?.key ?? ""
    }

    /**
     * Get the value for a given key.
     */
    protected getValueForKey(key: string): T {
        const option = this.options.find(opt => opt.key === key)
        if (!option) {
            throw new Error(`No option found for key: ${key}`)
        }
        return option.value
    }
}

/**
 * Base class for settings tab pages.
 */
export abstract class SettingsTabPage<T extends Plugin = Plugin> {
    public isActive: boolean = false

    protected _plugin: T
    protected _name: string

    /**
     * Creates a new SettingsTabPage instance.
     */
    constructor(plugin: T, name: string) {
        this._plugin = plugin
        this._name = name
    }

    /**
     * Gets the tab page ID.
     */
    get id(): string {
        return this._name.toLowerCase().replace(/\s+/g, "-")
    }

    /**
     * Gets the tab page name.
     */
    get name(): string {
        return this._name
    }

    /**
     * Gets the plugin instance.
     */
    get plugin(): T {
        return this._plugin
    }

    /**
     * Display the settings page content.
     * Override this method to implement the page content.
     */
    abstract display(containerEl: HTMLElement): void

    /**
     * Called when the tab becomes active.
     * Override this method to perform any initialization when the tab is shown.
     */
    onActivate(): void {
        // Override in subclasses if needed
    }

    /**
     * Called when the tab becomes inactive.
     * Override this method to perform any cleanup when the tab is hidden.
     */
    onDeactivate(): void {
        // Override in subclasses if needed
    }
}

/**
 * Manages a collection of settings tab pages and handles tab switching.
 */
export class SettingsTabManager {
    private tabs: SettingsTabPage[] = []
    private activeTab: SettingsTabPage | null = null
    private tabContainer: HTMLElement | null = null
    private contentContainer: HTMLElement | null = null

    /**
     * Adds a tab page to the manager.
     */
    addTab(tab: SettingsTabPage): SettingsTabManager {
        this.tabs.push(tab)
        return this
    }

    /**
     * Adds multiple tab pages to the manager.
     */
    addTabs(tabs: SettingsTabPage[]): SettingsTabManager {
        this.tabs.push(...tabs)
        return this
    }

    /**
     * Gets all registered tabs.
     */
    getTabs(): SettingsTabPage[] {
        return [...this.tabs]
    }

    /**
     * Gets the currently active tab.
     */
    getActiveTab(): SettingsTabPage | null {
        return this.activeTab
    }

    /**
     * Sets the active tab by index.
     */
    setActiveTab(index: number): void {
        if (index >= 0 && index < this.tabs.length) {
            const tab = this.tabs[index]
            if (tab) {
                this.activateTab(tab)
            }
        }
    }

    /**
     * Sets the active tab by ID.
     */
    setActiveTabById(id: string): void {
        const tab = this.tabs.find(t => t.id === id)
        if (tab) {
            this.activateTab(tab)
        }
    }

    /**
     * Activates a specific tab.
     */
    private activateTab(tab: SettingsTabPage): void {
        // Deactivate current tab
        if (this.activeTab) {
            this.activeTab.isActive = false
            this.activeTab.onDeactivate()
        }

        // Activate new tab
        this.activeTab = tab
        tab.isActive = true
        tab.onActivate()

        // Update UI
        this.updateTabButtonStyles()
        this.displayActiveTabContent()
    }

    /**
     * Displays the tab manager UI in the provided container.
     */
    display(containerEl: HTMLElement): void {
        if (this.tabs.length === 0) {
            throw new Error("No tabs have been added to the manager")
        }

        containerEl.empty()

        // Create tab container
        this.tabContainer = containerEl.createEl("div", {
            cls: "obskit-settings-tab-container",
        })

        // Create content container
        this.contentContainer = containerEl.createEl("div", {
            cls: "obskit-settings-tab-content",
        })

        // Create tab buttons
        this.tabs.forEach((tab, _index) => {
            const tabEl = this.tabContainer!.createEl("button", {
                text: tab.name,
                cls: "obskit-settings-tab-button",
            })

            tabEl.addEventListener("click", () => {
                this.activateTab(tab)
            })
        })

        // Activate first tab by default
        if (this.tabs.length > 0) {
            const firstTab = this.tabs[0]
            if (firstTab) {
                this.activateTab(firstTab)
            }
        }
    }

    /**
     * Updates the styles for the tab buttons.
     */
    private updateTabButtonStyles(): void {
        if (!this.tabContainer) return

        const tabButtons = this.tabContainer.querySelectorAll(".obskit-settings-tab-button")

        tabButtons.forEach((button, index) => {
            const tab = this.tabs[index]
            if (tab) {
                if (tab.isActive) {
                    button.addClass("obskit-settings-tab-button-active")
                } else {
                    button.removeClass("obskit-settings-tab-button-active")
                }
            }
        })
    }

    /**
     * Displays the content of the active tab.
     */
    private displayActiveTabContent(): void {
        if (!this.contentContainer || !this.activeTab) return

        this.contentContainer.empty()
        this.activeTab.display(this.contentContainer)
    }
}

/**
 * Base class for plugin settings tabs that provides tab functionality.
 * Extends Obsidian's PluginSettingTab and integrates with SettingsTabManager.
 */
export abstract class PluginSettingsTab extends PluginSettingTab {
    protected tabManager: SettingsTabManager

    constructor(app: App, plugin: Plugin) {
        super(app, plugin)
        this.tabManager = new SettingsTabManager()
        this.initializeTabs()
    }

    /**
     * Initialize the tabs for this settings tab.
     * Override this method to add your tab pages.
     */
    protected abstract initializeTabs(): void

    /**
     * Display the settings tab UI.
     */
    display(): void {
        this.tabManager.display(this.containerEl)
    }

    /**
     * Hide the settings tab UI.
     */
    hide(): void {
        // Clean up any active tab
        const activeTab = this.tabManager.getActiveTab()
        if (activeTab) {
            activeTab.isActive = false
            activeTab.onDeactivate()
        }
    }
}
