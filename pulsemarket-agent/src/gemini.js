import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

let genAI;

function getClient() {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is required in .env");
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
}

/**
 * Validate a market question before creation.
 * Returns { ok, verdict, reason }
 */
export async function validateMarketQuestion(question) {
  const model = getClient().getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are a prediction market quality evaluator. Evaluate the following market question and respond with ONLY valid JSON.

Question: "${question}"

Criteria:
1. Is the question unambiguous with a clear YES/NO answer?
2. Can it be objectively verified using a public data source (e.g. CoinGecko, ESPN, official results)?
3. Is it free from subjective interpretation?

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
    const json = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(json);
  } catch (err) {
    console.error("[gemini] validateMarketQuestion error:", err.message);
    return {
      verdict: "UNKNOWN",
      ok: true, // default to allow if AI fails
      reason: "AI validation unavailable — proceeding with caution.",
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
  const model = getClient().getGenerativeModel({ model: "gemini-1.5-flash" });

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
    const json = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(json);
    return {
      marketId: market.id,
      question: market.question,
      resolveTime: market.resolveTime,
      ...parsed,
      researchedAt: Date.now(),
    };
  } catch (err) {
    console.error(`[gemini] researchMarketOutcome error for market ${market.id}:`, err.message);
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
