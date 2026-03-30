import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";
import { logError } from "./errorLogging.js";

let genAI;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const MIN_CLOSE_LEAD_SECONDS = Number(
  process.env.MARKET_MIN_CLOSE_LEAD_SECONDS || "30",
);
const MAX_VALIDATION_FUTURE_DAYS = Number(
  process.env.MARKET_MAX_RESOLUTION_FUTURE_DAYS || "365",
);

function getClient() {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is required in .env");
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
}

/**
 * Validate a market question + timing window before creation.
 * Returns { ok, verdict, reason }
 */
export async function validateMarketQuestion({ question, closeTime, resolveTime }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const maxResolveSec =
    nowSec + Math.floor(MAX_VALIDATION_FUTURE_DAYS * 24 * 60 * 60);

  if (!Number.isFinite(closeTime) || !Number.isFinite(resolveTime)) {
    return {
      verdict: "INVALID_TIME_WINDOW",
      ok: false,
      reason: "Close and resolve times are required.",
      verificationSource: "N/A",
    };
  }

  if (closeTime <= nowSec + MIN_CLOSE_LEAD_SECONDS) {
    return {
      verdict: "INVALID_TIME_WINDOW",
      ok: false,
      reason: "Close time must be in the future.",
      verificationSource: "N/A",
    };
  }

  if (resolveTime < closeTime) {
    return {
      verdict: "INVALID_TIME_WINDOW",
      ok: false,
      reason: "Resolve time must be on or after close time.",
      verificationSource: "N/A",
    };
  }

  if (resolveTime > maxResolveSec) {
    return {
      verdict: "TOO_FAR_IN_FUTURE",
      ok: false,
      reason: `Resolve time is too far in the future (max ${MAX_VALIDATION_FUTURE_DAYS} days ahead).`,
      verificationSource: "N/A",
    };
  }

  const model = getClient().getGenerativeModel({ model: GEMINI_MODEL });
  const closeIso = new Date(closeTime * 1000).toISOString();
  const resolveIso = new Date(resolveTime * 1000).toISOString();
  const nowIso = new Date(nowSec * 1000).toISOString();

  const prompt = `You are a prediction market quality evaluator. Evaluate the following market question and respond with ONLY valid JSON.

Question: "${question}"
Current time (UTC): ${nowIso}
Close time (UTC): ${closeIso}
Resolve time (UTC): ${resolveIso}

Criteria:
1. Is the question unambiguous with a clear YES/NO answer?
2. Can it be objectively verified using a public data source (e.g. CoinGecko, ESPN, official results)?
3. Is it free from subjective interpretation?
4. Given the close/resolve timestamps, is the outcome likely to be objectively knowable by the resolve time?
5. If the event is likely too far in the future for reliable resolution, mark it as UNVERIFIABLE.

Respond with this exact JSON format:
{
  "verdict": "GOOD" | "AMBIGUOUS" | "UNVERIFIABLE",
  "ok": true | false,
  "reason": "One sentence explanation",
  "verificationSource": "How/where the outcome can be verified (e.g. CoinGecko BTC/USD close price)"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    // Strip markdown code fences if present
    const json = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const parsed = JSON.parse(json);
    return {
      ...parsed,
      ok: Boolean(parsed.ok),
    };
  } catch (err) {
    logError("[gemini] validateMarketQuestion error", err, {
      model: GEMINI_MODEL,
      question,
      closeTime,
      resolveTime,
      minCloseLeadSeconds: MIN_CLOSE_LEAD_SECONDS,
      maxValidationFutureDays: MAX_VALIDATION_FUTURE_DAYS,
    });
    return {
      verdict: "UNKNOWN",
      ok: false,
      reason: "AI validation unavailable — cannot approve market creation right now.",
      verificationSource: "N/A",
    };
  }
}

/**
 * Research a market's likely outcome using AI.
 * @param {object} market - { id, question, category, closeTime, resolveTime }
 * Returns { verdict: "YES"|"NO"|"UNCERTAIN", confidence: "HIGH"|"MEDIUM"|"LOW", reasoning, verificationSource }
 */
export async function researchMarketOutcome(market) {
  const model = getClient().getGenerativeModel({ model: GEMINI_MODEL });

  const closeDate = new Date(market.closeTime * 1000).toUTCString();
  const resolveDate = new Date(market.resolveTime * 1000).toUTCString();

  const prompt = `You are a prediction market resolution oracle. Research the outcome of this market.

Market Question: "${market.question}"
Category: ${market.category}
Market closed at: ${closeDate}
Resolution time: ${resolveDate}

Based on your knowledge, determine the most likely outcome as of the resolution time.
If the event was in the future relative to your knowledge cutoff, say UNCERTAIN.

Respond with ONLY valid JSON in this exact format:
{
  "verdict": "YES" | "NO" | "UNCERTAIN",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "2-3 sentence explanation of why you chose this verdict based on known facts",
  "verificationSource": "Where an admin can verify this result (e.g. 'CoinGecko BTC/USD historical data', 'ESPN game results', 'official announcement')"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const json = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const parsed = JSON.parse(json);
    return {
      marketId: market.id,
      question: market.question,
      resolveTime: market.resolveTime,
      ...parsed,
      researchedAt: Date.now(),
    };
  } catch (err) {
    logError(
      `[gemini] researchMarketOutcome error for market ${market.id}`,
      err,
      {
        model: GEMINI_MODEL,
        marketId: market.id,
        question: market.question,
        closeTime: market.closeTime,
        resolveTime: market.resolveTime,
      },
    );
    return {
      marketId: market.id,
      question: market.question,
      resolveTime: market.resolveTime,
      verdict: "UNCERTAIN",
      confidence: "LOW",
      reasoning: "AI research failed. Please resolve manually.",
      verificationSource: "N/A",
      researchedAt: Date.now(),
    };
  }
}
