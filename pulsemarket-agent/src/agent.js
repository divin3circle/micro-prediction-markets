import cron from "node-cron";
import { getMarketsToClose, getClosedMarkets } from "./marketApi.js";
import { closeMarket } from "./txHelper.js";
import { researchMarketOutcome } from "./gemini.js";

/**
 * In-memory verdict store.
 * Key: marketId, Value: verdict object from researchMarketOutcome
 */
export const verdictStore = new Map();

/** Track markets that are currently being processed to avoid double-runs */
const inProgress = new Set();

// ─── Cron 1: Auto-close markets (every 60 seconds) ───────────────────────────

async function runAutoClose() {
  let markets;
  try {
    markets = await getMarketsToClose();
  } catch (err) {
    console.error("[agent/auto-close] Failed to fetch markets:", err.message);
    return;
  }

  if (markets.length === 0) return;

  console.log(`[agent/auto-close] Found ${markets.length} market(s) to close.`);

  for (const market of markets) {
    if (inProgress.has(`close-${market.id}`)) continue;
    inProgress.add(`close-${market.id}`);

    try {
      const txHash = await closeMarket(market.id);
      console.log(`[agent/auto-close] Market ${market.id} closed. tx: ${txHash}`);
    } catch (err) {
      console.error(`[agent/auto-close] Failed to close market ${market.id}:`, err.message);
    } finally {
      inProgress.delete(`close-${market.id}`);
    }
  }
}

// ─── Cron 2: AI research on closed markets (every 5 minutes) ─────────────────

async function runAiResearch() {
  let markets;
  try {
    markets = await getClosedMarkets();
  } catch (err) {
    console.error("[agent/ai-research] Failed to fetch closed markets:", err.message);
    return;
  }

  // Only research markets we haven't processed yet
  const unresearched = markets.filter((m) => !verdictStore.has(m.id));

  if (unresearched.length === 0) return;

  console.log(`[agent/ai-research] Researching ${unresearched.length} market(s)…`);

  for (const market of unresearched) {
    if (inProgress.has(`research-${market.id}`)) continue;
    inProgress.add(`research-${market.id}`);

    try {
      console.log(`[agent/ai-research] Researching market ${market.id}: "${market.question}"`);
      const verdict = await researchMarketOutcome(market);
      verdictStore.set(market.id, verdict);
      console.log(
        `[agent/ai-research] Market ${market.id} verdict: ${verdict.verdict} (${verdict.confidence} confidence)`
      );
    } catch (err) {
      console.error(`[agent/ai-research] Failed to research market ${market.id}:`, err.message);
    } finally {
      inProgress.delete(`research-${market.id}`);
    }
  }
}

/**
 * Force-research a specific market (used by /api/research/:id).
 */
export async function researchMarket(market) {
  const verdict = await researchMarketOutcome(market);
  verdictStore.set(market.id, verdict);
  return verdict;
}

/**
 * Start all cron jobs.
 */
export function startAgent() {
  console.log("[agent] Starting PulseMarket agent…");

  // Run immediately on startup
  runAutoClose();
  runAiResearch();

  // Auto-close: every 60 seconds
  cron.schedule("* * * * *", () => {
    console.log("[agent/auto-close] Tick");
    runAutoClose();
  });

  // AI research: every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    console.log("[agent/ai-research] Tick");
    runAiResearch();
  });

  console.log("[agent] Cron jobs scheduled.");
}
