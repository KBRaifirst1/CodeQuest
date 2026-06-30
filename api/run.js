// api/run.js — Vercel serverless function that runs code via the public Piston API.
// Keeps the call server-side (avoids browser CORS) and returns a clean result.
// Piston is a free public code-execution API: https://github.com/engineer-man/piston

// Map our language IDs → Piston language names + versions.
// (Versions are what the public Piston instance currently offers.)
const PISTON_LANG = {
  py:     { language: "python",     version: "3.10.0" },
  python: { language: "python",     version: "3.10.0" },
  java:   { language: "java",       version: "15.0.2" },
  cpp:    { language: "c++",        version: "10.2.0" },
  c:      { language: "c",          version: "10.2.0" },
  csharp: { language: "csharp",     version: "6.12.0" },
  go:     { language: "go",         version: "1.16.2" },
  rust:   { language: "rust",       version: "1.68.2" },
  ruby:   { language: "ruby",       version: "3.0.1" },
  swift:  { language: "swift",      version: "5.3.3" },
  kotlin: { language: "kotlin",     version: "1.8.20" },
  php:    { language: "php",        version: "8.2.3" },
  ts:     { language: "typescript", version: "5.0.3" },
  js:     { language: "javascript", version: "18.15.0" },
  lua:    { language: "lua",        version: "5.4.4" },
  r:      { language: "rscript",    version: "4.1.1" },
  dart:   { language: "dart",       version: "2.19.6" },
  perl:   { language: "perl",       version: "5.36.0" },
  scala:  { language: "scala",      version: "3.2.2" },
  bash:   { language: "bash",       version: "5.2.0" },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { langId, code, stdin = "" } = req.body || {};
    const map = PISTON_LANG[langId];
    if (!map) return res.status(400).json({ error: "Unsupported language: " + langId });

    const r = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: map.language,
        version: map.version,
        files: [{ content: code }],
        stdin,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "Runner error " + r.status, detail });
    }
    const data = await r.json();
    // Piston returns { run: { stdout, stderr, code }, compile?: {...} }
    const run = data.run || {};
    const compile = data.compile || {};
    return res.status(200).json({
      stdout: (run.stdout || "").replace(/\s+$/, ""),
      stderr: (run.stderr || compile.stderr || "").replace(/\s+$/, ""),
      code: run.code,
      ok: run.code === 0 && !(compile.stderr),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
