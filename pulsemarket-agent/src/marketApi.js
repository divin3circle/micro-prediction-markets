import { rest, MODULE_ADDRESS, MODULE_NAME } from "./chain.js";

function parseViewData(res) {
  return JSON.parse(res.data);
}

function normalizeMarket(tuple) {
  return {
    id: Number(tuple[0]),
    question: tuple[1],
    category: tuple[2],
    closeTime: Number(tuple[3]),
    resolveTime: Number(tuple[4]),
    status: Number(tuple[5]),  // 0=OPEN, 1=CLOSED, 2=RESOLVED, 3=CANCELLED
    outcome: Number(tuple[6]),
    totalYesAmount: Number(tuple[7]),
    totalNoAmount: Number(tuple[8]),
    createdAt: Number(tuple[9]),
  };
}

export function statusLabel(status) {
  return ["OPEN", "CLOSED", "RESOLVED", "CANCELLED"][status] ?? "UNKNOWN";
}

export async function getMarketCount() {
  const res = await rest.move.view(MODULE_ADDRESS, MODULE_NAME, "get_market_count", [], []);
  return Number(parseViewData(res));
}

export async function getActiveMarketIds() {
  const res = await rest.move.view(MODULE_ADDRESS, MODULE_NAME, "get_active_market_ids", [], []);
  const ids = parseViewData(res);
  return ids.map((id) => Number(id));
}

/** Fetch a single market by id using BCS-encoded u64 arg */
export async function getMarket(marketId) {
  // BCS-encode u64: little-endian 8 bytes, base64
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(marketId));
  const b64 = buf.toString("base64");

  const res = await rest.move.view(MODULE_ADDRESS, MODULE_NAME, "get_market", [], [b64]);
  return normalizeMarket(parseViewData(res));
}

/** Fetch all markets (by iterating count) */
export async function getAllMarkets() {
  const count = await getMarketCount();
  const markets = [];
  for (let i = 0; i < count; i++) {
    try {
      const m = await getMarket(i);
      markets.push(m);
    } catch (err) {
      console.warn(`[marketApi] failed to fetch market ${i}:`, err.message);
    }
  }
  return markets;
}

/** Returns markets that need auto-closing (OPEN + closeTime passed) */
export async function getMarketsToClose() {
  const nowSec = Math.floor(Date.now() / 1000);
  const all = await getAllMarkets();
  return all.filter((m) => m.status === 0 && m.closeTime <= nowSec);
}

/** Returns markets ready for AI research + resolution (CLOSED) */
export async function getClosedMarkets() {
  const all = await getAllMarkets();
  return all.filter((m) => m.status === 1);
}

export async function getStats() {
  const all = await getAllMarkets();
  const byStatus = [0, 0, 0, 0];
  let totalVolume = 0;
  for (const m of all) {
    if (m.status >= 0 && m.status <= 3) byStatus[m.status]++;
    totalVolume += m.totalYesAmount + m.totalNoAmount;
  }
  return {
    total: all.length,
    open: byStatus[0],
    closed: byStatus[1],
    resolved: byStatus[2],
    cancelled: byStatus[3],
    totalVolume,
    markets: all,
  };
}
