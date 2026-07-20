/**
 * Recipe Book — AI parsing proxy (Cloudflare Worker)
 *
 * The web app calls window.claude.complete(...) which POSTs here. This Worker
 * holds the Anthropic API key as a secret and forwards the request to the
 * Messages API, so the key never ships to the browser.
 *
 * Accepts a JSON body in one of two shapes (both produced by the app):
 *   { "prompt": "<text>" }
 *   { "messages": [ ... ], "max_tokens": 4000 }   // used for photo parsing
 * and responds with { "text": "<model output>" }.
 *
 * Secrets / vars (set via `wrangler secret put` / wrangler.toml [vars]):
 *   ANTHROPIC_API_KEY  (secret, required)
 *   MODEL              (var, optional — defaults to claude-sonnet-5)
 *   ALLOWED_ORIGIN     (var, optional — comma-separated origins allowed to call
 *                       this proxy; defaults to "*". Lock this to your Pages
 *                       origin, e.g. "https://<you>.github.io", to stop other
 *                       sites from spending your API quota.)
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_MAX_TOKENS = 4000;

function corsHeaders(request, env) {
  const allow = (env.ALLOWED_ORIGIN || "*").trim();
  const origin = request.headers.get("Origin") || "";
  let allowOrigin = "*";
  if (allow !== "*") {
    const list = allow.split(",").map((s) => s.trim()).filter(Boolean);
    allowOrigin = list.includes(origin) ? origin : list[0] || "*";
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Use POST." }, 405, cors);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "Proxy missing ANTHROPIC_API_KEY." }, 500, cors);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400, cors);
    }

    // Normalise the two shapes the app sends into a Messages API request.
    const messages =
      typeof payload.prompt === "string"
        ? [{ role: "user", content: payload.prompt }]
        : payload.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "Body must include a prompt string or a messages array." }, 400, cors);
    }

    const req = {
      model: env.MODEL || DEFAULT_MODEL,
      max_tokens: payload.max_tokens || DEFAULT_MAX_TOKENS,
      messages,
    };

    let apiRes;
    try {
      apiRes = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(req),
      });
    } catch (e) {
      return json({ error: "Upstream request failed: " + e.message }, 502, cors);
    }

    if (!apiRes.ok) {
      const detail = await apiRes.text();
      return json({ error: "Anthropic API error", status: apiRes.status, detail }, apiRes.status, cors);
    }

    const data = await apiRes.json();
    const text = Array.isArray(data.content)
      ? data.content.filter((b) => b.type === "text").map((b) => b.text).join("")
      : "";

    return json({ text }, 200, cors);
  },
};
