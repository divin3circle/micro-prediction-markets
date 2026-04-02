import { GoogleGenerativeAI } from "@google/generative-ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
// createRequire no longer needed — EventSource polyfill removed
import "dotenv/config";
import { logError } from "./errorLogging.js";

// StreamableHTTPClientTransport uses fetch (not EventSource/SSE),
// so no EventSource polyfill is needed.

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

const VALIDATION_VERDICTS = new Set(["GOOD", "AMBIGUOUS", "UNVERIFIABLE"]);
const VALIDATION_CONFIDENCE = new Set(["HIGH", "MEDIUM", "LOW"]);

function extractFirstJsonObject(text) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  if (cleaned.startsWith("{")) return cleaned;
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function normalizeValidationResponse(parsed) {
  const verdict = VALIDATION_VERDICTS.has(parsed?.verdict)
    ? parsed.verdict
    : "AMBIGUOUS";

  const reason =
    typeof parsed?.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim().slice(0, 280)
      : "Model output did not include a valid reason.";

  const verificationSource =
    typeof parsed?.verificationSource === "string" &&
    parsed.verificationSource.trim()
      ? parsed.verificationSource.trim().slice(0, 280)
      : "N/A";

  const confidence = VALIDATION_CONFIDENCE.has(parsed?.confidence)
    ? parsed.confidence
    : "LOW";

  const reasonCode =
    typeof parsed?.reasonCode === "string" && parsed.reasonCode.trim()
      ? parsed.reasonCode.trim().toUpperCase().slice(0, 64)
      : "INVALID_MODEL_OUTPUT";

  const ok = typeof parsed?.ok === "boolean" ? parsed.ok : verdict === "GOOD";

  return {
    verdict,
    ok,
    reason,
    verificationSource,
    confidence,
    reasonCode,
  };
}

/**
 * Validate a market question + timing window before creation.
 * Returns { ok, verdict, reason }
 */
export async function validateMarketQuestion({
  question,
  closeTime,
  resolveTime,
}) {
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
1. Question must resolve to a single, objective YES or NO.
2. Outcome must be verifiable from a public source.
3. Wording must avoid subjective terms (e.g., "strong", "major", "good", "likely").
4. Event must be knowable by resolve time.
5. If source or event is unclear, reject it.

Scoring policy:
- Return "GOOD" only if all criteria pass.
- Return "AMBIGUOUS" if wording or outcome logic is unclear.
- Return "UNVERIFIABLE" if no reliable public source or event cannot be known by resolve time.

OUTPUT RULES (STRICT):
- Return ONLY raw JSON, no markdown, no extra keys, no prose before/after.
- Use this exact schema and enum values:
{
  "verdict": "GOOD" | "AMBIGUOUS" | "UNVERIFIABLE",
  "ok": true | false,
  "reason": "single sentence, max 180 chars",
  "verificationSource": "specific source + metric/event to check",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasonCode": "SHORT_MACHINE_READABLE_CODE"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const json = extractFirstJsonObject(text);

    if (!json) {
      console.warn(
        `[gemini] validateMarketQuestion: no JSON found. Raw: ${text.slice(0, 200)}`,
      );
      return {
        verdict: "AMBIGUOUS",
        ok: false,
        reason: "AI response was not in the expected JSON format.",
        verificationSource: "N/A",
        confidence: "LOW",
        reasonCode: "INVALID_MODEL_OUTPUT",
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (parseErr) {
      console.warn(
        `[gemini] validateMarketQuestion: JSON parse failed. Raw JSON: ${json.slice(0, 200)}`,
      );
      return {
        verdict: "AMBIGUOUS",
        ok: false,
        reason: "AI response contained malformed JSON.",
        verificationSource: "N/A",
        confidence: "LOW",
        reasonCode: "MALFORMED_JSON",
      };
    }

    return normalizeValidationResponse(parsed);
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
      reason:
        "AI validation unavailable — cannot approve market creation right now.",
      verificationSource: "N/A",
    };
  }
}

async function performMCPToolCall(toolName, args, timeoutMs = 15000) {
  let transport;
  try {
    console.log(`[gemini/mcp] Executing tool: ${toolName} with args:`, args);
    let mcpUrl =
      process.env.MCP_SERVER_URL ||
      "https://pulsemarket-mcp.sylus-abel.workers.dev/mcp";
    mcpUrl = mcpUrl.trim().replace(/\/$/, "");
    if (!mcpUrl.endsWith("/mcp")) {
      mcpUrl += "/mcp";
    }
    console.log(`[gemini/mcp] Using Streamable HTTP URL: ${mcpUrl}`);
    transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

    const client = new Client(
      {
        name: "PulseMarket Agent",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    await client.connect(transport);
    console.log(`[gemini/mcp] Connected to MCP via Streamable HTTP.`);

    const result = await client.callTool(
      {
        name: toolName,
        arguments: args,
      },
      undefined,
      { timeout: timeoutMs },
    );

    try {
      await transport.close();
    } catch (e) {}

    if (result && result.content && result.content.length > 0) {
      return result.content[0].text;
    }

    return JSON.stringify(result);
  } catch (err) {
    console.error(`[gemini/mcp] Server tool error`, err);
    if (transport) {
      try {
        await transport.close();
      } catch (e) {}
    }
    return `Tool failed: ${err.message}`;
  }
}

/**
 * Research a market's likely outcome using AI.
 * @param {object} market - { id, question, category, closeTime, resolveTime }
 * Returns { verdict: "YES"|"NO"|"UNCERTAIN", confidence: "HIGH"|"MEDIUM"|"LOW", reasoning, verificationSource }
 */
export async function researchMarketOutcome(market) {
  const mcpTools = {
    functionDeclarations: [
      {
        name: "web_search",
        description:
          "Search the live web for current events, news, and facts. Use this tool for general knowledge, sports, and news.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description:
                "The specific search query to execute (e.g. 'Who won the Lakers game last night?')",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_crypto_price",
        description:
          "Fetch the exact, real-time price of a cryptocurrency in USD. Prefer this tool over web_search for crypto price markets.",
        parameters: {
          type: "OBJECT",
          properties: {
            coinId: {
              type: "STRING",
              description:
                "The ID of the coin (e.g. 'bitcoin', 'ethereum', 'solana', 'initia'). Use full names, not tickers.",
            },
          },
          required: ["coinId"],
        },
      },
    ],
  };

  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    tools: [mcpTools],
  });

  const closeDate = new Date(market.closeTime * 1000).toUTCString();
  const resolveDate = new Date(market.resolveTime * 1000).toUTCString();

  const prompt = `You are a prediction market resolution oracle. Research the outcome of this market.

Market Question: "${market.question}"
Category: ${market.category}
Market closed at: ${closeDate}
Resolution time: ${resolveDate}

IMPORTANT RULES: 
1. If the current date is close to or past your knowledge cutoff, you MUST use the "web_search" tool to gather live information.
2. Even if you think you know the answer, use the "web_search" tool to verify exact figures like crypto prices or recent sports outcomes before finalizing your verdict.
3. Be as definitive as possible (YES or NO) based on what you find.
4. Only return UNCERTAIN if the search results explicitly contradict each other or the exact outcome is genuinely unknowable.

SEARCH STRATEGY BEST PRACTICES (CRITICAL FOR 100% ACCURACY):
- Do NOT just copy/paste the market question into the search tool. Reframe it into a highly targeted information query.
- Use explicit dates, times, and specific entities. (e.g., instead of "Did ETH go above 2100 today?", use "ETH USD price chart closing history \${resolveDate}").
- For sports, search the exact match date and teams (e.g., "Lakers vs Warriors final box score \${resolveDate}").
- If your first search query doesn't yield the exact answer, you are allowed up to 3 tool calls. For your next attempt, change the query strategy. Try targeting a specific authoritative source by appending words like "CoinGecko", "ESPN", "Reuters", or "Bloomberg" to your query.
- Always compare the verified timestamp of the event against the market's Resolution time to ensure the event actually concluded.

OUTPUT FORMAT — CRITICAL: Your final message MUST be ONLY a raw JSON object with no text before or after it. Do NOT write any sentences, summaries, or explanations outside the JSON block. Respond ONLY with this exact structure:
{
  "verdict": "YES" | "NO" | "UNCERTAIN",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "2-3 sentence explanation of why you chose this verdict based on known facts and web search results",
  "verificationSource": "Where an admin can verify this result based on your tool output"
}`;

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    console.log(
      `[gemini] Research start market=${market.id} now=${nowSec} resolveTime=${market.resolveTime}`,
    );

    const chat = model.startChat({
      tools: [mcpTools],
    });
    let result = await chat.sendMessage(prompt);

    // Check if the model decided to call the web_search tool
    let responseObj = result.response;
    let funcCall = responseObj.functionCalls()?.[0];
    let toolCallsMade = 0;

    if (!funcCall) {
      console.log(
        `[gemini] Model returned without tool call for market ${market.id}.`,
      );
    }

    // Allow up to 3 chained tool calls to gather full context if needed
    let maxLoops = 3;
    while (funcCall && maxLoops > 0) {
      const toolName = funcCall.name;
      const toolArgs = funcCall.args;
      toolCallsMade++;

      const toolResultStr = await performMCPToolCall(toolName, toolArgs);

      // Feed the result back to Gemini
      result = await chat.sendMessage([
        {
          functionResponse: {
            name: toolName,
            response: { result: toolResultStr },
          },
        },
      ]);

      responseObj = result.response;
      funcCall = responseObj.functionCalls()?.[0];
      maxLoops--;
    }

    const text = responseObj.text().trim();
    // Robust JSON extraction: strip markdown fences, then find the first { … } block
    let json = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    // If text doesn't start with '{', try to extract the JSON object from within
    if (!json.startsWith("{")) {
      const match = json.match(/\{[\s\S]*\}/);
      if (match) {
        json = match[0];
      } else {
        // Gemini returned pure text with no JSON — treat as UNCERTAIN, don't crash
        console.warn(
          `[gemini] No JSON found in response for market ${market.id}. toolCallsMade=${toolCallsMade}. Raw: ${text.slice(0, 200)}`,
        );
        return {
          marketId: market.id,
          question: market.question,
          resolveTime: market.resolveTime,
          verdict: "UNCERTAIN",
          confidence: "LOW",
          reasoning: "AI response was not in the expected JSON format.",
          verificationSource: "N/A",
          researchedAt: Date.now(),
        };
      }
    }
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
