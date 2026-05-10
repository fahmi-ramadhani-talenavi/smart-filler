# Smart Filler v2

Chrome extension for smart form autofilling with realistic data. Targets **~95-97% real-world coverage** by navigating framework boundaries (React, Vue, Angular, Svelte) and complex UI components.

## Core Capabilities

- **Smart Detection**: Uses a weighted signal system (WHATWG autocomplete, ARIA labels, semantic regex, ancestor context, and nearby text) to identify fields accurately in multiple languages.
- **Framework-Aware**: Bypasses synthetic event interception in modern JS frameworks using native value setters and simulated user event chains.
- **Multi-Pass Engine**: Executes up to 5 passes with DOM stability monitoring to handle dependent fields (e.g., Province > City), wizard steps, and lazy-loaded sections.
- **Bilingual Support**: Full data packs for **English (US)** and **Indonesian**, with localized generators for NIK, NPWP, and Phone numbers.
- **Safety First**: Built-in honeypot detection to avoid bot-traps and invisible fields.

## Supported Components

| Category | Targeted Libraries / Components |
|---|---|
| **UI Frameworks** | Vuetify, PrimeVue, Ant Design, MUI, Chakra UI, Headless UI |
| **Selects** | React-Select, Select2, Chosen, ARIA Comboboxes |
| **Editors** | Quill, ProseMirror (Tiptap), Slate.js, Generic ContentEditable |
| **Dates** | PrimeVue Calendar, React-DatePicker, Native HTML5 Date |

## Installation (Developer Mode)

1. Open `chrome://extensions/` in your browser.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `smart-filler/` root directory.
4. Pin the extension for quick access.

## Usage

- **Popup**: Click the extension icon, choose your **Language**, and click **Fill Form**.
- **Stop**: Click the **Stop** button to immediately halt an active filling process.
- **Clear**: Click **Clear** to reset filled fields.
- **Shortcuts**: 
  - `Alt+Shift+F`: Fill Form
  - `Alt+Shift+C`: Clear Form
- **Context Menu**: Right-click any field to fill a single field or the whole form.

## Project Structure

```
smart-filler/
├─ manifest.json
├─ background.js          Keyboard & context menu bridge
├─ content.js             Main engine (Adapters, Multi-pass, Honeypot)
├─ data/
│  ├─ checksums.js        Validators (Luhn, NIK, NPWP, Phone)
│  ├─ en.js               English Language Pack
│  └─ id.js               Indonesian Language Pack
├─ popup.html / .css / .js
└─ README.md
```

## Limitations

1. **Closed Shadow DOM**: Cannot pierce closed roots (e.g., Stripe Elements) without debugger permissions.
2. **Cross-Origin Iframes**: Restricted by browser Same-Origin Policy (SOP).
3. **Canvas Inputs**: Figma/Google Docs have no DOM inputs to target.

## Author

Developed with ❤️ by **Fahmi (lukaririnki26)**.

## License

MIT License. For development and testing purposes only.
