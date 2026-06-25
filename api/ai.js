// api/ai.js — Vercel serverless function.
// Holds your Gemini API key SECRETLY (server-side) and calls Gemini on behalf
// of the app. The browser never sees the key. It accepts the same shape the
// app already uses ({ messages, system, maxTokens }) and returns { text }.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });
  }

  try {
    const { messages = [], system = "", maxTokens = 900 } = req.body || {};

    // Translate the app's {role, content} messages into Gemini's "contents" format.
    // Gemini uses role "user"/"model" and parts:[{text}].
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

    const body = {
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    };
    // The app's "system" prompt → Gemini's systemInstruction.
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }

    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: `Gemini error ${r.status}`, detail });
    }

    const data = await r.json();
    // Pull the text out of Gemini's response shape.
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim() || "";

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
