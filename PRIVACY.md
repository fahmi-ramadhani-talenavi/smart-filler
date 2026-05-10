# Privacy Policy — Smart Filler

_Last updated: 2026-05-10_

Smart Filler ("the extension") is a developer and QA utility that populates web forms with locally generated test data. Privacy is a core principle of this project.

## 1. Data Collection

**We do not collect any data.**

Smart Filler does not transmit, sell, or share any personal information, browsing history, form contents, or telemetry. The extension contains no analytics, no remote logging, and no remote code execution.

## 2. Local Storage

The extension uses `chrome.storage.local` to store your preferences on your device only.

| Key | Type | Purpose |
|---|---|---|
| `language` | `string` | Persists your selection between English and Indonesian. |

This value never leaves your machine. Uninstalling the extension permanently removes all stored data.

## 3. Data Generation

All data generation happens locally within the browser context. 
- No network requests are made to fetch or generate data.
- Generated data (names, IDs, card numbers) is fictitious and structurally valid for testing purposes only.
- Once inserted into a form, the extension does not retain or track that data.

## 4. Permissions

| Permission | Rationale |
|---|---|
| `activeTab` | Required to interact with the page you are currently viewing. |
| `scripting` | Required to inject the filler engine when triggered via popup or shortcut. |
| `storage` | Required to remember your language preference. |
| `host_permissions` | Allows the extension to work on any website where you choose to trigger it. |

## 5. Third Parties

There are no third-party integrations, CDN-loaded fonts, or trackers. The extension is entirely self-contained.

## 6. Contact

For questions or security concerns, please open an issue on the official project repository.
