# CodeQuest → Real App (GitHub + Vercel + Supabase)

This turns your CodeQuest artifact into a real, deployed app where **everything
saves per user**. Three free accounts, about 30–40 minutes the first time.

The flow: **Supabase** stores the data + logins → **GitHub** holds your code →
**Vercel** hosts the live site and auto-deploys on every push.

---

## What's in this package

```
supabase-schema.sql           ← run once in Supabase (creates the table + security)
.env.example                  ← copy to .env, fill in your keys
package.json                  ← dependencies (Vite + React + Supabase)
src/
  lib/
    supabase.js               ← connects to your Supabase project
    persistence.js            ← load/save state (handles the Set conversion)
    useCloudSave.js           ← one hook: auth + load + autosave
  components/
    AuthGate.jsx              ← the sign-in screen (magic link OR password)
  App.jsx                     ← wrapper showing how to plug it into your app
```

You'll also add **one file you already have**: your CodeQuest component,
saved as `src/CodeQuestApp.jsx` (see Step 4).

---

## Step 1 — Supabase (the database + logins)

1. Go to **supabase.com** → create a free account → **New project**.
   Pick a name and a strong database password (save it somewhere).
2. Wait ~2 minutes for it to finish setting up.
3. Open **SQL Editor** (left sidebar) → **New query** → paste the entire
   contents of `supabase-schema.sql` → **Run**. You should see "Success".
4. Open **Project Settings → API**. Copy two things:
   - **Project URL**  → this is your `VITE_SUPABASE_URL`
   - **anon / public** key → this is your `VITE_SUPABASE_ANON_KEY`
5. (For magic-link / email) Open **Authentication → Providers → Email** and make
   sure **Email** is enabled. For the smoothest start you can turn **"Confirm email"
   off** while testing, then turn it back on later.

> The **anon key is safe in the browser** — the Row Level Security policies in the
> schema are what actually protect each user's data. Never use the `service_role` key
> in front-end code.

---

## Step 2 — Get the code on your computer

1. Make a new folder and put all these files in it (keep the `src/` structure).
2. Add your existing app as `src/CodeQuestApp.jsx` — see **Step 4**.
3. Create the remaining Vite files (`index.html`, `vite.config.js`, `src/main.jsx`)
   — minimal versions are in **Appendix A** below.
4. Copy `.env.example` to `.env` and paste in your two Supabase values.
5. In a terminal in that folder:
   ```bash
   npm install
   npm run dev
   ```
   Open the local URL it prints. You should see the **sign-in screen**.
   Sign in, and you're in the app — now backed by the cloud.

---

## Step 3 — GitHub

1. Create a free account at **github.com** → **New repository** → name it
   `codequest` → **Create**.
2. In your project folder:
   ```bash
   git init
   git add .
   git commit -m "CodeQuest with cloud save"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/codequest.git
   git push -u origin main
   ```
   > Make sure `.env` is **not** committed — a `.gitignore` with `.env` and
   > `node_modules` is included in this package.

---

## Step 4 — Turn your artifact into `src/CodeQuestApp.jsx`

Your artifact is one big component. To use it here:

1. Copy your `codequest-hub.jsx` into `src/CodeQuestApp.jsx`.
2. At the top, keep `import React, { useState, useEffect, useRef } from "react";`
3. Rename `export default function App()` to
   `export default function CodeQuestApp({ initialState, onPersist, onSignOut })`.
4. Make the **three small changes** shown in `src/App.jsx`:
   - **seed** state from `initialState`
   - **autosave** with a `useEffect` that calls `onPersist`
   - (optional) a **Sign out** button calling `onSignOut`

Because `loadState()` returns `progress` as real `Set`s, the rest of your code
(`doneSetFor`, `markDone`, etc.) works unchanged.

---

## Step 5 — Vercel (deploy + keys)

1. Go to **vercel.com** → sign up **with your GitHub account** (one click).
2. **Add New → Project** → import your `codequest` repo.
3. Vercel auto-detects Vite. Before deploying, open **Environment Variables**
   and add the same two as in your `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**. In ~1 minute you get a live URL like
   `https://codequest-you.vercel.app`.
5. **One more Supabase setting:** in Supabase → **Authentication → URL
   Configuration**, add your Vercel URL to **Site URL** and **Redirect URLs**
   (so magic links land back on your live site, not localhost).

Done. From now on, **every `git push` auto-deploys**, and **every user's
progress, AI lessons, and finished projects save to their account.**

---

## Appendix A — the three tiny Vite files

**index.html**
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>CodeQuest</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
```

**vite.config.js**
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });
```

**src/main.jsx**
```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
```

---

## Notes & gotchas

- **Free tiers** are plenty for this. Supabase free includes a real Postgres DB
  and auth; Vercel free hosts the site; GitHub free holds the code.
- **Costs nothing** unless you grow a lot.
- If sign-in emails don't arrive, check spam, and verify the Site URL / Redirect
  URLs in Supabase match your live Vercel URL exactly.
- If data isn't saving, open the browser console — load/save errors are logged
  there, and the usual cause is a missing or mistyped env var.
