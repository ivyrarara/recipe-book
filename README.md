# Recipe Book

A mobile-web recipe book: Cooking / Baking tabs, live search, drag-to-reorder
cards, per-recipe ingredient scaling, inline-editable ingredients, a revertible
"Modify" log, and an **AI "Add a recipe"** flow that parses pasted text or a
photo into a structured recipe.

It's a single static page (`index.html`) plus a small vendored runtime — no
build step. The AI parsing calls a tiny serverless proxy so the Anthropic API
key stays off the client.

## Layout

| Path | What it is |
|------|------------|
| `index.html` | The whole app (design template + logic). |
| `vendor/` | React, ReactDOM, and the `dc-runtime` that renders the template. Loaded locally, so the page has no external runtime dependency. |
| `proxy/` | Cloudflare Worker that forwards AI-parsing requests to the Anthropic API. |
| `.github/workflows/deploy.yml` | Publishes the site to GitHub Pages. |

## Deploy

### 1. Publish the site (GitHub Pages)
Settings → **Pages** → *Build and deployment* → **Source: GitHub Actions**.
The workflow then deploys on every push to `main`. Your site appears at
`https://<user>.github.io/recipe-book/`.

The app works immediately — browse, search, scale, edit, reorder, and add
manual tweaks. Only the **AI** "Snap a photo" / "Save this recipe" parsing
needs the proxy below.

### 2. Deploy the AI proxy (Cloudflare Workers, free tier)
```bash
cd proxy
npx wrangler deploy                       # deploys the Worker
npx wrangler secret put ANTHROPIC_API_KEY # paste your Anthropic API key
```
Wrangler prints the Worker URL, e.g. `https://recipe-proxy.<you>.workers.dev`.

Then, to keep others from spending your quota, set `ALLOWED_ORIGIN` in
`proxy/wrangler.toml` to your Pages origin (e.g. `https://<user>.github.io`)
and redeploy.

> Prefer Vercel/Netlify/Deno? The Worker is ~30 lines of standard `fetch`
> handling — port `proxy/worker.js` to any serverless function that can hold
> the `ANTHROPIC_API_KEY` secret.

### 3. Point the app at the proxy
In `index.html`, set:
```js
window.RECIPE_PROXY_URL = "https://recipe-proxy.<you>.workers.dev";
```
Commit and push — Pages redeploys and AI parsing goes live.

## Notes
- Fonts (Instrument Serif, DM Sans) load from Google Fonts.
- Recipe data lives in browser state only (no backend/persistence) — this is a
  front-end prototype. Reloading resets to the seed recipes.
