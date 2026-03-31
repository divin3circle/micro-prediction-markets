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
      reason:
        "AI validation unavailable — cannot approve market creation right now.",
      verificationSource: "N/A",
    };
  }
}

/**
 * Performs an MCP tool call (web_search or get_crypto_price).
 */
async function performMCPToolCall(toolName, args) {
  try {
    console.log(`[gemini/mcp] Executing tool: ${toolName} with args:`, args);
    // Assuming you run the Cloudflare worker locally on port 8787.
    // In production, update this to your deployed worker URL.
    // Note: The HTTP bridging in a production MCP setup might strictly require SSE or standard JSON-RPC over HTTP.
    // Since we modeled the Worker to currently handle root `/search` dynamically, we'd need to adapt our worker for native MCP bridging.
    // *Important:* Since the worker is a standard Cloudflare MCP template using `@modelcontextprotocol/sdk`, it expects either SSE or POST over `/mcp`.
    // Instead of building a full JSON-RPC client from scratch here, let's just use simple fetch bridging for this hackathon context,
    // assuming we adapt the worker to respond to simple POSTs if the full MCP client SDK is too heavy, OR we can use standard JSON-RPC.

    // For now, we will simulate the connection using the standard JSON RPC payload expected by the MCP server `fetch` handler.
    const MCP_SERVER_URL =
      process.env.MCP_SERVER_URL || "http://127.0.0.1:8787/mcp";

    const jsonRpcPayload = {
      jsonrpc: "2.0",
      id: Date.now().toString(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const res = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonRpcPayload),
    });

    if (!res.ok) {
      console.error(
        `[gemini/mcp] Tool ${toolName} failed with status ${res.status}`,
      );
      return `Error: Service unavailable (${res.status})`;
    }

    const data = await res.json();

    // The MCP SDK usually returns { result: { content: [...] } }
    if (data.result && data.result.content && data.result.content.length > 0) {
      return data.result.content[0].text;
    }

    return JSON.stringify(data);
  } catch (err) {
    console.error(`[gemini/mcp] Network error to MCP server`, err);
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

When you are ready to conclude, respond with ONLY valid JSON in this exact format:
{
  "verdict": "YES" | "NO" | "UNCERTAIN",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "2-3 sentence explanation of why you chose this verdict based on known facts and web search results",
  "verificationSource": "Where an admin can verify this result based on your tool output"
}`;

  try {
    const chat = model.startChat();
    let result = await chat.sendMessage(prompt);

    // Check if the model decided to call the web_search tool
    let responseObj = result.response;
    let funcCall = responseObj.functionCalls()?.[0];

    // Allow up to 3 chained tool calls to gather full context if needed
    let maxLoops = 3;
    while (funcCall && maxLoops > 0) {
      const toolName = funcCall.name;
      const toolArgs = funcCall.args;

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
