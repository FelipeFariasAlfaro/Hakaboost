# TESTING — Judges Checklist & Instructions

This guide contains everything needed to evaluate the extension end‑to‑end.

## 1) Prerequisites
- **Chrome** with Manifest V3 support.
- **A Jira Cloud site** you can access (create a dummy issue to test).
- **One AI Provider** *(can you choose one)*:
  - **Chrome Built-in AI** (default AI) You need to have Chrome Built-in AI enabled locally.
  - **OpenAI** API key. Enable the model `gpt-4o-mini` or any compatible chat model in your account.
  - **OR** **Google Gemini** API key (e.g., `gemini-2.5-flash`).

*(Optional for Xray features)*
- Xray Cloud **client_id** and **client_secret** (from your Xray account).

## 2) Install the Extension
1. Download or clone the repository.
2. Open Chrome → `chrome://extensions` → enable **Developer mode**.
3. Click **Load unpacked** → select the repository folder.
4. The extension “Hajaboost” should appear.

## 3) Configure Credentials (Side Panel → Settings)
- **AI**
  - If using **Chrome Built-in AI**: no tokens needed. You need to have Chrome Built-in AI enabled locally. You can see how in https://developer.chrome.com/docs/ai/built-in?hl=es-419
  - If using **OpenAI**: paste your **API key** and choose a **model** (e.g., `gpt-4o-mini`).
  - If using **Gemini**: paste your **API key** and set a model (e.g., `gemini-2.5-flash`).
- **Jira**
  - Base URL (e.g., `https://your-site.atlassian.net`)
  - Email
  - Jira API Token (from Atlassian account profile → security → API tokens).
- **Xray Cloud (optional)**
  - client_id / client_secret.

> Credentials are stored locally in the browser via `chrome.storage.sync`.

## 4) Functional Test
1. Open a Jira issue page (e.g., `/browse/PROJ-123`).
2. Open the extension side panel (toolbar icon or `Ctrl+Shift+Y` / `Cmd+Shift+Y`).
3. Click **Refresh** to fetch issue metadata (key, title, status).
4. Click **Load Description** to fetch the current description from Jira.
5. Click **Improve** → the AI generates an improved description.
6. Click **Replace Description** → confirm the replace in Jira.
7. (Optional) Click **Create Tests** to generate test artifacts:
   - If **Xray** is enabled and credentials provided, the extension can set the Xray Test Type and update Gherkin content.
   - You can also **Export Cucumber** features (downloaded as files).

## 5) Acceptance Criteria (What to Look For)
- **UI**: side panel loads on Jira issue pages; keyboard shortcut works.
- **AI**: improved description is generated according to the model chosen.
- **Jira write‑back**: description replaced successfully.
- **(Optional) Xray**: test issue created/updated as configured; cucumber export works.
- **No errors** in the DevTools console (Service Worker / content script).
- **No secrets** committed into the repo (tokens are user‑provided at runtime).

## 6) Troubleshooting
- If side panel says you're not on Jira, make sure the URL matches `*.atlassian.net/*` and open an actual issue page.
- If AI fails, verify the token/model and your account access. The extension queries `/v1/models` (OpenAI) to validate tokens.
- If Jira calls fail, verify Base URL + Email + API token.
- If a push to `main` is blocked in your environment, ensure your Jira permissions allow editing issue descriptions.
- Big organizations may block third‑party domains; ensure `api.openai.com` or Google Gemini endpoints are reachable if you use them.

---

**That’s it!** With the steps above, judges can install, configure, and validate the core value of Hajaboost.
