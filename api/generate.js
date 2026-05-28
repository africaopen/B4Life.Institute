/* =====================================================================
   B4Life.Institute · Doculectures · Anthropic API proxy
   Vercel Serverless Function  (lives at  /api/generate )
   ---------------------------------------------------------------------
   The browser sends the generation request here; this function adds your
   SECRET Anthropic key on the server and forwards it to Anthropic, then
   returns the answer. Your key NEVER appears in the website's code.

   You set the key in Vercel (Project → Settings → Environment Variables):
       ANTHROPIC_API_KEY = sk-ant-...          (required)
       ALLOWED_ORIGIN    = https://b4life.institute   (recommended; locks it to your site)
   ===================================================================== */

const ANTHROPIC_URL     = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS_CAP    = 1200;                          // hard ceiling per call (cost control)
const ALLOWED_MODELS    = ["claude-sonnet-4-20250514"];  // only the model the app uses

export default async function handler(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN || "*";
  const origin  = req.headers.origin || "";

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", allowed === "*" ? "*" : allowed);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  // Optional origin lock
  if (allowed !== "*" && origin && origin !== allowed)
    return res.status(403).json({ error: "Origin not allowed" });

  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(500).json({ error: "Server not configured: ANTHROPIC_API_KEY is missing" });

  // Body (Vercel parses JSON automatically, but guard anyway)
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON body" }); } }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Missing body" });

  // Guardrails to keep costs predictable
  if (typeof body.max_tokens !== "number" || body.max_tokens > MAX_TOKENS_CAP) body.max_tokens = MAX_TOKENS_CAP;
  if (ALLOWED_MODELS.length && !ALLOWED_MODELS.includes(body.model)) body.model = ALLOWED_MODELS[0];

  let upstream;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return res.status(502).json({ error: "Upstream request failed" });
  }

  const text = await upstream.text();
  res.status(upstream.status);
  res.setHeader("Content-Type", "application/json");
  return res.send(text);
}
