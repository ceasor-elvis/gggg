require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "mistral-large-latest";

// The browser never sees the API key — it only ever talks to this local
// endpoint. This server is the only thing that holds the key and the only
// thing that talks to Mistral.
app.post("/api/ai", async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing 'prompt' in request body" });
    }
    if (!MISTRAL_KEY) {
      return res.status(500).json({ error: "Server has no MISTRAL_API_KEY set. Add one to your .env file and restart." });
    }

    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MISTRAL_KEY}`,
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("Mistral API error:", r.status, errText);
      return res.status(r.status).json({ error: `Mistral API error ${r.status}` });
    }

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || "";
    res.json({ text });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Simple health check so you can confirm the key loaded without printing it.
app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasKey: Boolean(MISTRAL_KEY), model: MISTRAL_MODEL });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nFight Scorer running at http://localhost:${PORT}`);
  console.log(MISTRAL_KEY ? "Mistral key loaded from .env — AI features are live.\n" : "WARNING: no MISTRAL_API_KEY found in .env — AI features will fail.\n");
});
