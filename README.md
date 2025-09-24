# HakaBoost — Chrome Extension for Jira (MV3)

**HakaBoost** optimizes Jira issue descriptions and accelerates QA workflows using AI (OpenAI, Gemini, or local Chrome AI when available). It also helps create test artifacts and integrates with **Xray Cloud**.

> This repository is open-source under the **MIT License** (see `LICENSE`).

## Features
- ✨ Improve Jira issue descriptions with AI (OpenAI/Gemini).
- 🧪 Create tests (Jira/Xray Cloud integration).
- 🧩 Side Panel UI: works on Jira Cloud issue pages.
- ⌨️ Shortcut: `Ctrl+Shift+Y` / `Cmd+Shift+Y` to toggle the panel.
- 🔐 Tokens stored in `chrome.storage.sync` on your browser (never sent to our servers).

## Requirements
- Google Chrome (Manifest V3 support).
- A Jira Cloud site with an issue to test on (e.g., `https://your-site.atlassian.net/browse/PROJ-1`).
- One AI provider:
  - **OpenAI** API key (recommended): enable a small, low-cost model like `gpt-4o-mini`.
  - **or** **Google Gemini** API key (e.g., `gemini-2.5-flash`).
  - **Optional**: Chrome's local AI (Language Model API) if supported in your Chrome build.

- (Optional) **Xray Cloud** credentials for test features (client id/secret).

## Install (Load Unpacked)
1. Clone or download this repo.
2. Open `chrome://extensions` → enable **Developer mode**.
3. Click **Load unpacked** → select this folder.
4. You should see **HakaBoost** in your toolbar or extensions list.

## Configuration (Side Panel → Settings)
- **AI Provider**
  - **Chrome IA Built-in**
  - **OpenAI token** and **model** (e.g., `gpt-4o-mini`).
  - **Gemini token** and **model** (e.g., `gemini-2.5-flash`).
- **Jira**
  - **Base URL** (e.g., `https://your-site.atlassian.net`), **Email**, and **Jira API token**.
- **Xray Cloud** (optional)
  - **client_id** and **client_secret** (only if you enable Xray features).
- (Optional) Default issue type for items created by the tool.

> All values are stored locally in your browser via `chrome.storage.sync`.

## Usage
1. Open any Jira issue page in your Jira Cloud (e.g., `/browse/PROJ-123`).
2. Click the **Hajaboost** icon (or press `Ctrl+Shift+Y` / `Cmd+Shift+Y`) to open the side panel.
3. Press **Load Description** to pull the current description.
4. Press **Improve** to generate a higher‑quality description.
5. **Replace** to push it back into Jira.
6. (Optional) Use **Create Tests** to create test artifacts; if Xray is enabled, you can set the Xray test type and export cucumber features.

## Permissions (Manifest v3)
- `"activeTab"`, `"scripting"`, `"tabs"`, `"webNavigation"`, `"downloads"`, `"storage"`, `"sidePanel"`
- Host access: Atlassian/Jira Cloud, OpenAI, Xray Cloud (see `manifest.json`).

## Privacy
- No server owned by this project receives your data.
- Tokens (OpenAI/Gemini/Jira/Xray) are saved only in your browser (`chrome.storage.sync`).
- When using external AI providers, your prompts/descriptions are sent to those providers per their terms.

## Development
- Background service worker: `background.js`
- Content script for Jira DOM extraction: `content.js`
- Side panel UI/logic: `sidepanel.html`, `sidepanel.js`, `js/*`

## License
This project is licensed under the **MIT License**. See `LICENSE` for details.
