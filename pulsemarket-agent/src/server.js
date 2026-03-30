import express from "express";
import cors from "cors";
import "dotenv/config";
import { startAgent, verdictStore, researchMarket } from "./agent.js";
import { getStats, getAllMarkets, getMarket } from "./marketApi.js";
import { resolveMarket } from "./txHelper.js";
import { validateMarketQuestion } from "./gemini.js";
import { CHAIN_ID, LCD_URL, MODULE_ADDRESS, MODULE_NAME } from "./chain.js";
import { logError } from "./errorLogging.js";

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

/** Admin-only route guard */
function requireAdmin(req, res, next) {
  if (!ADMIN_SECRET) return next(); // No secret configured — open access
  const secret = req.headers["x-admin-secret"];
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Public routes ────────────────────────────────────────────────────────────

/** Health check */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

/** All markets with stats */
app.get("/api/stats", async (_req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    logError("[server] /api/stats failed", err);
    res.status(500).json({ error: err.message });
  }
});

/** All markets */
app.get("/api/markets", async (_req, res) => {
  try {
    const markets = await getAllMarkets();
    res.json(markets);
  } catch (err) {
    logError("[server] /api/markets failed", err);
    res.status(500).json({ error: err.message });
  }
});

/** All AI verdicts */
app.get("/api/verdicts", (_req, res) => {
  try {
    res.json(Object.fromEntries(verdictStore));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Single verdict */
app.get("/api/verdicts/:id", (req, res) => {
  const id = Number(req.params.id);
  const verdict = verdictStore.get(id);
  if (!verdict)
    return res.status(404).json({ error: "No verdict yet for this market" });
  res.json(verdict);
});

// ─── Admin-only routes ────────────────────────────────────────────────────────

/** Manually trigger AI research for a specific market */
app.post("/api/research/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const market = await getMarket(id);
    const verdict = await researchMarket(market);
    res.json(verdict);
  } catch (err) {
    logError(`[server] /api/research/${id} failed`, err, { marketId: id });
    res.status(500).json({ error: err.message });
  }
});

/** Oracle resolves a market */
app.post("/api/resolve/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { yesWon } = req.body;
  if (typeof yesWon !== "boolean") {
    return res
      .status(400)
      .json({ error: "yesWon (boolean) is required in request body" });
  }
  try {
    const txHash = await resolveMarket(id, yesWon);
    res.json({ success: true, txHash, marketId: id, yesWon });
  } catch (err) {
    logError(`[server] /api/resolve/${id} failed`, err, {
      marketId: id,
      yesWon,
    });
    res.status(500).json({ error: err.message });
  }
});

/** Validate a market question before creating */
app.post("/api/validate-question", async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) {
    return res.status(400).json({ error: "question is required" });
  }
  try {
    const result = await validateMarketQuestion(question);
    res.json(result);
  } catch (err) {
    logError("[server] /api/validate-question failed", err, { question });
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[server] PulseMarket agent API listening on http://127.0.0.1:${PORT}`,
  );
  console.log(
    `[server] config: chainId=${CHAIN_ID}, lcdUrl=${LCD_URL}, module=${MODULE_ADDRESS}::${MODULE_NAME}, geminiModel=${process.env.GEMINI_MODEL || "gemini-2.5-flash-lite"}`,
  );
  startAgent();
});
