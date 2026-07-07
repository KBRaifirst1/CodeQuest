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
    const { messages = [], system = "", maxTokens = 900, thinking = false } = req.body || {};

    // Translate the app's {role, content} messages into Gemini's "contents" format.
    // Gemini uses role "user"/"model" and parts:[{text}].
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

    // gemini-2.5-flash is a *thinking* model: by default it spends output tokens
    // on internal reasoning before writing the answer. For our JSON-generation
    // tasks that reasoning can eat the whole budget, leaving the actual JSON
    // truncated or empty (which shows up in the app as "no JSON in response").
    // So thinking is OFF by default. The client opts specific calls IN via
    // `thinking: true` — only for correctness-critical work (runnable code,
    // graded solutions) where the reasoning is worth the extra tokens/latency.
    //   thinkingBudget: 0  → thinking disabled (fast, all tokens go to output)
    //   thinkingBudget: -1 → dynamic (model decides how much to think)
    // Note: when thinking is on, reasoning shares maxOutputTokens with the
    // answer, so thinking-enabled calls in the app pass a larger maxTokens.
    const thinkingBudget = thinking === true ? -1 : 0;
    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget },
        // Ask Gemini to return raw JSON when we're generating structured data.
        // (Harmless for the tutor/chat calls too — they don't set responseMimeType.)
      },
    };
    // The app's "system" prompt → Gemini's systemInstruction.
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }

    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Single call to Gemini, returns { ok, status, detail?, text, finishReason }.
    const callGemini = async (reqBody) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      if (!r.ok) {
        const detail = await r.text();
        return { ok: false, status: r.status, detail };
      }
      const data = await r.json();
      const cand = data?.candidates?.[0];
      const finishReason = cand?.finishReason || "";
      const text = cand?.content?.parts?.map((p) => p.text || "").join("").trim() || "";
      return { ok: true, text, finishReason };
    };

    let result = await callGemini(body);

    // Fallback: a thinking-enabled call can spend so many tokens reasoning that
    // it hits MAX_TOKENS before writing any answer (thinking shares the output
    // budget). If that happens, retry ONCE with thinking disabled so the whole
    // budget goes to the answer. Better a non-thinking answer than an empty one.
    if (result.ok && !result.text && result.finishReason === "MAX_TOKENS" && thinking === true) {
      const fallbackBody = {
        ...body,
        generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingBudget: 0 } },
      };
      result = await callGemini(fallbackBody);
    }

    if (!result.ok) {
      return res.status(502).json({ error: `Gemini error ${result.status}`, detail: result.detail });
    }

    const finishReason = result.finishReason;
    const text = result.text;

    // If Gemini produced no text, tell the app WHY instead of returning "" (which
    // the parser can only report as "no JSON in response"). Common reasons:
    //   MAX_TOKENS  → answer didn't fit; the app should raise maxTokens / shorten
    //   SAFETY      → blocked by Gemini's safety filters
    //   RECITATION  → blocked for potential copyright recitation
    if (!text) {
      const reason =
        finishReason === "MAX_TOKENS" ? "Gemini ran out of output space (MAX_TOKENS) before writing anything — try fewer lessons." :
        finishReason === "SAFETY" ? "Gemini blocked this request on safety grounds (SAFETY)." :
        finishReason === "RECITATION" ? "Gemini blocked this response (RECITATION)." :
        finishReason ? `Gemini returned no text (finishReason: ${finishReason}).` :
        "Gemini returned an empty response.";
      return res.status(502).json({ error: reason, finishReason });
    }

    // Return the text plus finishReason so the client can tell a truncated
    // response apart from a complete one if it wants to.
    return res.status(200).json({ text, finishReason });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
