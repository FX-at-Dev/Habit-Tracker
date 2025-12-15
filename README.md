# Habit Tracker

[![Made with JavaScript](https://img.shields.io/badge/Made%20with-JavaScript-f7df1e?logo=javascript&logoColor=000)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Netlify Functions](https://img.shields.io/badge/Netlify-Functions-00C7B7?logo=netlify&logoColor=fff)](https://docs.netlify.com/functions/overview/)

A lightweight, single-page habit dashboard that lets you track daily habits in a monthly grid, visualize progress with charts, and optionally sync across devices using Firebase (served via a Netlify Function).

## What it does

- Tracks habits per day (monthly table)
- Shows progress charts (daily flow line chart, weekly totals bar chart, weekly rhythm radar chart, completion donut)
- Calculates totals + streaks per habit
- Supports dark/light theme toggle
- Imports/exports your data as JSON
- Optional cloud sync across devices (Firebase Auth anonymous + Firestore)

## Why it’s useful

- **Fast to run**: no build step; open in any modern browser via a simple local server.
- **Data ownership**: data is stored locally in `localStorage` by default; export a backup anytime.
- **Visual feedback**: charts and streaks make trends obvious.
- **Cross-device option**: enable cloud sync when you want it, keep it off when you don’t.

## Getting started

### 1) Run locally (no cloud sync)

This app should be served over `http://…` (not opened via `file://…`) so features like Cloud Sync can work when enabled.

From the project folder:

**Option A: Python**

```bash
py -m http.server 5173
```

Then open:

- http://localhost:5173/

**Option B: Node (serve)**

```bash
npx serve .
```

### 2) Use the app

- **Add a habit**: type a name → “+ Add Habit”
- **Mark a day**: click a cell in the monthly grid
- **Switch month/year**: use the dropdowns in the header
- **Backup**: “⬇ Export” downloads a JSON file
- **Restore**: “⬆ Import” loads a previously exported JSON file
- **Theme**: click the theme toggle (sun/moon)

### 3) (Optional) Enable Cloud Sync (Firebase + Netlify Functions)

Cloud Sync is optional and off by default. When enabled, the app syncs `habits` and `appData` to a Firestore document keyed by a “Sync Code”. Anyone with the Sync Code can read/write that shared dataset.

#### Prerequisites

- A Firebase project
- Firestore enabled
- **Anonymous Auth** enabled (the app uses `signInAnonymously()`)

#### Local development with Netlify Functions

This repo includes a Netlify Function that serves Firebase config at:

- `/.netlify/functions/firebase-config`

It reads these environment variables:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`

Steps:

1. Install the Netlify CLI:

   ```bash
   npm i -g netlify-cli
   ```

2. Create a local `.env` file (this repo ignores `.env` via `.gitignore`):

   ```dotenv
   FIREBASE_API_KEY=...
   FIREBASE_AUTH_DOMAIN=...
   FIREBASE_PROJECT_ID=...
   FIREBASE_APP_ID=...
   ```

3. Start the dev server with functions enabled:

   ```bash
   netlify dev
   ```

4. Open the local URL printed by Netlify CLI, then click **☁️ Sync**.

#### Deploying on Netlify

- Set the same `FIREBASE_*` variables in Netlify: **Site settings → Environment variables**.
- The function lives in `netlify/functions` and is wired up via `netlify.toml`.

## Project structure

- `index.html` – UI layout and CDN scripts (Chart.js + Firebase compat)
- `style.css` – styling, theme tokens, layout
- `script.js` – app logic (storage, rendering, charts, import/export, cloud sync)
- `netlify/functions/firebase-config.js` – returns Firebase config from env vars
- `netlify.toml` – Netlify Functions directory config

## Data format

Exported backups look like:

```json
{
  "habits": [{"id":"h1","name":"Read 30 Mins","color":"#a0e7e5"}],
  "appData": {"h1": ["2025-12-15", "2025-12-16"]},
  "exportDate": "2025-12-15T10:20:30.000Z"
}
```

## Getting help

- Check the code comments in `script.js` (Cloud Sync section at the top explains configuration).
- If this is in a GitHub repo: open an Issue with repro steps, browser, and screenshots.

## Contributing

Contributions are welcome.

- Fork the repo and create a branch: `git checkout -b feature/my-change`
- Test locally (see “Getting started” above)
- Open a Pull Request with a short description and screenshots if UI changes

## Security

If you discover a vulnerability, avoid filing a public issue with sensitive details. Prefer a GitHub Security Advisory (if enabled) or contact the maintainer.

Cloud Sync notes:

- Treat the **Sync Code** like a shared secret (anyone with it can potentially access the synced dataset)
- Don’t paste Sync Codes into issues, screenshots, or recordings
- If a Sync Code is leaked, create a new one and stop using the old one

Secrets:

- Don’t commit `.env` files
- Configure Firebase via `FIREBASE_*` environment variables (local `.env` for `netlify dev`, and Netlify environment variables for deploys)

## Maintainers

- Maintained by the repository owner(s). (The UI/footer references “FX at Dev”. If you’re publishing this repo, update this section with your preferred contact.)

