import cron from "node-cron";
import { getMarketsToClose, getClosedMarkets, getAllMarkets } from "./marketApi.js";
import { closeMarket, resolveMarket } from "./txHelper.js";
import { researchMarketOutcome } from "./gemini.js";
import { logError } from "./errorLogging.js";

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
    logError("[agent/auto-close] Failed to fetch markets", err, {
      phase: "getMarketsToClose",
    });
    return;
  }

  if (markets.length === 0) return;

  console.log(`[agent/auto-close] Found ${markets.length} market(s) to close.`);

  for (const market of markets) {
    if (inProgress.has(`close-${market.id}`)) continue;
    inProgress.add(`close-${market.id}`);

    try {
      const txHash = await closeMarket(market.id);
      console.log(
        `[agent/auto-close] Market ${market.id} closed. tx: ${txHash}`,
      );
    } catch (err) {
      logError(`[agent/auto-close] Failed to close market ${market.id}`, err, {
        marketId: market.id,
        question: market.question,
        closeTime: market.closeTime,
      });
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
    logError("[agent/ai-research] Failed to fetch closed markets", err, {
      phase: "getClosedMarkets",
    });
    return;
  }

  // Only research markets we haven't processed yet
  const unresearched = markets.filter((m) => !verdictStore.has(m.id));

  if (unresearched.length === 0) return;

  console.log(
    `[agent/ai-research] Researching ${unresearched.length} market(s)…`,
  );

  for (const market of unresearched) {
    if (inProgress.has(`research-${market.id}`)) continue;
    inProgress.add(`research-${market.id}`);

    try {
      console.log(
        `[agent/ai-research] Researching market ${market.id}: "${market.question}"`,
      );
      const verdict = await researchMarketOutcome(market);
      verdictStore.set(market.id, verdict);
      console.log(
        `[agent/ai-research] Market ${market.id} verdict: ${verdict.verdict} (${verdict.confidence} confidence)`,
      );
    } catch (err) {
      logError(
        `[agent/ai-research] Failed to research market ${market.id}`,
        err,
        {
          marketId: market.id,
          question: market.question,
          resolveTime: market.resolveTime,
        },
      );
    } finally {
      inProgress.delete(`research-${market.id}`);
    }
  }
}

// ─── Cron 3: Auto-resolve markets based on verdicts (every 60 seconds) ────────

async function runAutoResolve() {
  let allMarkets;
  try {
    allMarkets = await getAllMarkets();
  } catch (err) {
    logError("[agent/auto-resolve] Failed to fetch markets", err, {
      phase: "getAllMarkets",
    });
    return;
  }

  // Filter to CLOSED markets (status === 1) that have verdicts in verdictStore
  const toResolve = allMarkets.filter((m) => {
    // Must be CLOSED
    if (m.status !== 1) return false;
    // Must have a verdict from AI research
    if (!verdictStore.has(m.id)) return false;
    // Don't auto-resolve if confidence is LOW
    const verdict = verdictStore.get(m.id);
    if (verdict.confidence === "LOW") return false;
    return true;
  });

  if (toResolve.length === 0) return;

  console.log(
    `[agent/auto-resolve] Found ${toResolve.length} market(s) ready to resolve.`,
  );

  for (const market of toResolve) {
    const resolveKey = `resolve-${market.id}`;
    if (inProgress.has(resolveKey)) continue;
    inProgress.add(resolveKey);

    try {
      const verdict = verdictStore.get(market.id);
      const yesWon = verdict.verdict === "YES";

      console.log(
        `[agent/auto-resolve] Resolving market ${market.id}: "${market.question}" → ${verdict.verdict} (${verdict.confidence})`,
      );

      const txHash = await resolveMarket(market.id, yesWon);
      console.log(
        `[agent/auto-resolve] Market ${market.id} resolved to ${verdict.verdict}. tx: ${txHash}`,
      );
    } catch (err) {
      logError(`[agent/auto-resolve] Failed to resolve market ${market.id}`, err, {
        marketId: market.id,
        question: market.question,
        verdict: verdictStore.get(market.id),
      });
    } finally {
      inProgress.delete(resolveKey);
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
  runAutoResolve();

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

  // Auto-resolve: every 60 seconds
  cron.schedule("* * * * *", () => {
    console.log("[agent/auto-resolve] Tick");
    runAutoResolve();
  });

  console.log("[agent] Cron jobs scheduled.");
}
