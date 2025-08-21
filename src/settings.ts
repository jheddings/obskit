import { Setting } from 'obsidian'

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
    return option?.key ?? this.options[0]?.key ?? ''
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
