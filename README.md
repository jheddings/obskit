# obskit

This is a simple set of base utilities for [Obsidian](https://obsidian.md) plugins, providing reusable components and helpers to streamline plugin development.

## Installation

```bash
npm install obskit
```

## Features

- **Setting Components**: Pre-built setting UI components for common plugin settings
- **Type Safety**: Full TypeScript support with proper type definitions
- **Obsidian Integration**: Seamless integration with Obsidian's API

## Usage

### Basic Import

```typescript
import { ToggleSetting, SliderSetting, TextAreaSetting, DropdownSetting } from 'obskit'
```

### Toggle Setting

Create a boolean toggle setting:

```typescript
class MyToggleSetting extends ToggleSetting {
    private _value = false

    get value(): boolean {
        return this._value
    }

    set value(val: boolean) {
        this._value = val
    }

    get default(): boolean {
        return false
    }
}

// Usage in your plugin's settings tab
const toggleSetting = new MyToggleSetting({
    name: 'Enable Feature',
    description: 'Turn this feature on or off',
})

toggleSetting
    .onChange(value => {
        console.log('Toggle changed to:', value)
        // Save to plugin settings
    })
    .display(containerEl)
```

### Slider Setting

Create a numeric slider setting:

```typescript
class MySliderSetting extends SliderSetting {
    private _value = 50

    get value(): number {
        return this._value
    }

    set value(val: number) {
        this._value = val
    }

    get default(): number {
        return 50
    }

    get minimum(): number {
        return 0
    }

    get maximum(): number {
        return 100
    }

    get step(): number {
        return 1
    }
}

// Usage
const sliderSetting = new MySliderSetting({
    name: 'Opacity Level',
    description: 'Set the opacity percentage',
})

sliderSetting
    .onChange(value => {
        console.log('Slider changed to:', value)
    })
    .display(containerEl)
```

### Text Area Setting

Create a multi-line text input:

```typescript
class MyTextAreaSetting extends TextAreaSetting {
    private _value = ''

    get value(): string {
        return this._value
    }

    set value(val: string) {
        this._value = val
    }

    get default(): string {
        return ''
    }

    get placeholder(): string | null {
        return 'Enter your custom text here...'
    }
}

// Usage
const textAreaSetting = new MyTextAreaSetting({
    name: 'Custom Template',
    description: 'Define your custom template text',
})

textAreaSetting
    .onChange(value => {
        console.log('Text changed to:', value)
    })
    .display(containerEl)
```

### Dropdown Setting

Create a dropdown with predefined options:

```typescript
type ThemeOption = 'light' | 'dark' | 'auto'

class MyDropdownSetting extends DropdownSetting<ThemeOption> {
    private _value: ThemeOption = 'auto'

    get value(): ThemeOption {
        return this._value
    }

    set value(val: ThemeOption) {
        this._value = val
    }

    get default(): ThemeOption {
        return 'auto'
    }

    get options(): { key: string; label: string; value: ThemeOption }[] {
        return [
            { key: 'light', label: 'Light Theme', value: 'light' },
            { key: 'dark', label: 'Dark Theme', value: 'dark' },
            { key: 'auto', label: 'Auto (System)', value: 'auto' },
        ]
    }
}

// Usage
const dropdownSetting = new MyDropdownSetting({
    name: 'Theme Selection',
    description: 'Choose your preferred theme',
})

dropdownSetting
    .onChange(value => {
        console.log('Theme changed to:', value)
    })
    .display(containerEl)
```

### Complete Plugin Settings Example

Here's how you might use these settings in a complete Obsidian plugin:

```typescript
import { Plugin, PluginSettingTab, Setting } from 'obsidian'
import { ToggleSetting, SliderSetting, DropdownSetting } from 'obskit'

interface MyPluginSettings {
    enableFeature: boolean
    opacity: number
    theme: 'light' | 'dark' | 'auto'
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    enableFeature: false,
    opacity: 50,
    theme: 'auto',
}

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings

    async onload() {
        await this.loadSettings()
        this.addSettingTab(new MyPluginSettingTab(this.app, this))
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
    }

    async saveSettings() {
        await this.saveData(this.settings)
    }
}

class MyPluginSettingTab extends PluginSettingTab {
    plugin: MyPlugin

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    display(): void {
        const { containerEl } = this
        containerEl.empty()

        // Feature toggle
        class FeatureToggle extends ToggleSetting {
            constructor(private plugin: MyPlugin) {
                super({
                    name: 'Enable Feature',
                    description: 'Turn the main feature on or off',
                })
            }

            get value(): boolean {
                return this.plugin.settings.enableFeature
            }

            set value(val: boolean) {
                this.plugin.settings.enableFeature = val
            }

            get default(): boolean {
                return DEFAULT_SETTINGS.enableFeature
            }
        }

        new FeatureToggle(this.plugin)
            .onChange(async () => {
                await this.plugin.saveSettings()
            })
            .display(containerEl)

        // Opacity slider
        class OpacitySlider extends SliderSetting {
            constructor(private plugin: MyPlugin) {
                super({
                    name: 'Opacity',
                    description: 'Set the opacity level',
                })
            }

            get value(): number {
                return this.plugin.settings.opacity
            }

            set value(val: number) {
                this.plugin.settings.opacity = val
            }

            get default(): number {
                return DEFAULT_SETTINGS.opacity
            }

            get minimum(): number {
                return 0
            }
            get maximum(): number {
                return 100
            }
            get step(): number {
                return 1
            }
        }

        new OpacitySlider(this.plugin)
            .onChange(async () => {
                await this.plugin.saveSettings()
            })
            .display(containerEl)
    }
}
```

## API Reference

### BaseSetting<T>

Base class for all setting components.

#### Methods

- `onChange(callback: (value: T) => void): BaseSetting<T>` - Set change callback
- `display(containerEl: HTMLElement): Setting` - Render the setting in the container

#### Abstract Properties

- `value: T` - Current value
- `default: T` - Default value

### ToggleSetting

Boolean toggle setting component.

### SliderSetting

Numeric slider setting component.

#### Additional Abstract Properties

- `minimum: number` - Minimum slider value
- `maximum: number` - Maximum slider value
- `step: number` - Slider step increment

### TextAreaSetting

Multi-line text input setting component.

#### Additional Properties

- `placeholder: string | null` - Optional placeholder text

### DropdownSetting<T>

Dropdown selection setting component.

#### Additional Abstract Properties

- `options: { key: string; label: string; value: T }[]` - Available options

## License

MIT
