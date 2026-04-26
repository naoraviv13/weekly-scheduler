# Routine — Run & Deploy Guide

This guide takes you from the prototype (`schedule-prototype.jsx`) to a real running web app, then to a public URL anyone can visit.

> ⚠️ **One thing to know first**: the prototype uses `window.storage` (a Claude artifact-only API). The first step below replaces it with `localStorage` so it works in a normal browser. After that, everything is standard React.

---

## Part 1 — Run it locally (10 minutes)

### Prerequisites
- **Node.js 18+** ([nodejs.org](https://nodejs.org)) — check with `node -v`
- A code editor (VS Code recommended)
- Terminal access

### Step 1: Create a new Vite + React project

```bash
npm create vite@latest routine -- --template react
cd routine
npm install
```

### Step 2: Install the icon library used in the prototype

```bash
npm install lucide-react
```

### Step 3: Replace the default app with the prototype

Open `src/App.jsx` and replace **everything** with the contents of `schedule-prototype.jsx`.

### Step 4: Swap `window.storage` for `localStorage`

In `App.jsx`, find the **`useEffect` for loading** (around line 95) and replace it with:

```js
useEffect(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.templates) setTemplates(data.templates);
      if (data.weekAssignments) setWeekAssignments(data.weekAssignments);
      if (data.oneTimeTasks) setOneTimeTasks(data.oneTimeTasks);
      if (data.completed) setCompleted(new Set(data.completed));
    }
  } catch (e) { /* use defaults */ }
  setLoaded(true);
}, []);
```

Find the **`useEffect` for saving** (right below it) and replace with:

```js
useEffect(() => {
  if (!loaded) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      templates,
      weekAssignments,
      oneTimeTasks,
      completed: Array.from(completed),
    }));
  } catch (e) { console.error('Save failed:', e); }
}, [templates, weekAssignments, oneTimeTasks, completed, loaded]);
```

### Step 5: Run it

```bash
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). You should see the app. Add a template, refresh the page, and confirm your changes persist.

### Step 6 (optional): Test on your phone over the local network

```bash
npm run dev -- --host
```

Vite will print a "Network" URL like `http://192.168.1.42:5173`. Open that on your phone (must be on the same Wi-Fi). The mobile bottom nav should kick in automatically.

---

## Part 2 — Deploy publicly (5 minutes, free)

You have three solid options. **Vercel is the easiest** — pick that unless you have a reason not to.

### Option A: Vercel (recommended)

**Why:** Free tier, zero config, automatic HTTPS, deploys on every git push.

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create routine --public --source=. --push
   ```
   *(or use the GitHub website — create a repo, then `git remote add origin <url>` and `git push -u origin main`)*

2. Go to [vercel.com](https://vercel.com), sign in with GitHub.
3. Click **Add New → Project**, select your `routine` repo.
4. Vercel auto-detects Vite. Click **Deploy**.
5. Done. You get a URL like `https://routine-yourname.vercel.app`.

To use a custom domain (e.g. `routine.yourdomain.com`): Project → Settings → Domains → Add. Vercel walks you through the DNS setup.

### Option B: Netlify

Same idea as Vercel. Drag your `dist` folder onto [app.netlify.com/drop](https://app.netlify.com/drop) for an instant deploy, or connect your GitHub repo for auto-deploys.

To get a `dist` folder, run:
```bash
npm run build
```

### Option C: GitHub Pages

Free if you already use GitHub. Slightly more setup:

1. Install the deploy helper:
   ```bash
   npm install --save-dev gh-pages
   ```

2. Add to `package.json`:
   ```json
   "homepage": "https://YOUR_USERNAME.github.io/routine",
   "scripts": {
     ...
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```

3. In `vite.config.js`, add `base: '/routine/'` to the config.

4. Deploy:
   ```bash
   npm run deploy
   ```

5. In your repo settings → Pages → set source to `gh-pages` branch.

---

## What you get out of the box

- ✅ Working app on any device with the URL
- ✅ HTTPS automatic (Vercel/Netlify)
- ✅ Each user's data stored locally in *their* browser (`localStorage`)
- ✅ Auto-deploys when you push code (Vercel/Netlify)

## What you DON'T get yet

- ❌ **Multi-device sync** — your data lives in one browser. Open the app on your phone and you'll see fresh defaults.
- ❌ **Authentication** — the app is public; anyone visiting sees the same starting state.
- ❌ **Backups** — clear your browser data and your templates are gone.

---

## When you're ready for "real backend"

The next step (when you outgrow `localStorage`) is to add:

1. **Auth** — [Clerk](https://clerk.com) or [Supabase Auth](https://supabase.com) (both have generous free tiers)
2. **Database** — [Supabase](https://supabase.com) (Postgres) or [Firebase](https://firebase.google.com) (NoSQL). Supabase is the better fit for this data model.
3. **API layer** — Supabase gives you this for free (auto-generated from your schema). Otherwise add a small Next.js API or Express server.

The data model from the prototype maps cleanly to four Postgres tables: `users`, `templates`, `tasks` (with a `template_id` FK), `week_assignments`, `one_time_tasks`, `completions`. Ask me when you're ready and I'll write the schema + migration.

---

## Troubleshooting

**"Module not found: lucide-react"** → Run `npm install lucide-react` in the project folder.

**App shows defaults every refresh** → You forgot to swap `window.storage` for `localStorage` in Step 4. Open DevTools → Console and look for errors mentioning `window.storage`.

**Styles look broken** → The app uses Google Fonts. Check that you have internet access on first load (they cache after).

**Mobile nav doesn't appear** → Resize your browser below 700px width or open DevTools → Toggle device toolbar (Cmd/Ctrl+Shift+M).
