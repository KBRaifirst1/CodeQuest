// api/run.js — runs code via the public Piston API, auto-resolving the current
// version for each language (so it never breaks when Piston bumps versions).
// Piston: https://github.com/engineer-man/piston

const PISTON = "https://emkc.org/api/v2/piston";

// Our language IDs → Piston's canonical language names. Names are stable;
// versions are looked up live from /runtimes so nothing goes stale.
const LANG_NAME = {
  py: "python", python: "python", java: "java", cpp: "c++", c: "c",
  csharp: "csharp", go: "go", rust: "rust", ruby: "ruby", swift: "swift",
  kotlin: "kotlin", php: "php", ts: "typescript", js: "javascript",
  lua: "lua", r: "rscript", dart: "dart", perl: "perl", scala: "scala", bash: "bash",
};

// Cache the runtimes list so we don't refetch on every run (per warm instance).
let _runtimes = null;
let _runtimesAt = 0;
const RUNTIMES_TTL = 10 * 60 * 1000; // 10 minutes

async function getRuntimes() {
  const now = Date.now();
  if (_runtimes && now - _runtimesAt < RUNTIMES_TTL) return _runtimes;
  const r = await fetch(`${PISTON}/runtimes`);
  if (!r.ok) throw new Error("Could not load runtimes (" + r.status + ")");
  _runtimes = await r.json();
  _runtimesAt = now;
  return _runtimes;
}

function resolveRuntime(langId, runtimes) {
  const name = LANG_NAME[langId] || langId;
  const matches = runtimes.filter(
    (rt) => rt.language === name || (rt.aliases || []).includes(langId) || (rt.aliases || []).includes(name)
  );
  if (!matches.length) return null;
  // newest version first (numeric-aware compare)
  matches.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  return { language: matches[0].language, version: matches[0].version };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { langId, code, stdin = "" } = req.body || {};
    if (!code || !langId) return res.status(400).json({ error: "Missing code or langId" });

    let runtime;
    try {
      const runtimes = await getRuntimes();
      runtime = resolveRuntime(langId, runtimes);
    } catch (e) {
      return res.status(502).json({ error: "Runner list unavailable: " + String(e.message) });
    }
    if (!runtime) return res.status(400).json({ error: "Language not available on the runner: " + langId });

    const r = await fetch(`${PISTON}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ content: code }],
        stdin,
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "Runner error " + r.status, detail });
    }
    const data = await r.json();
    const run = data.run || {};
    const compile = data.compile || {};
    return res.status(200).json({
      stdout: (run.stdout || "").replace(/\s+$/, ""),
      stderr: (run.stderr || compile.stderr || "").replace(/\s+$/, ""),
      code: run.code,
      ok: run.code === 0 && !compile.stderr,
      ranWith: runtime.language + "@" + runtime.version,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
