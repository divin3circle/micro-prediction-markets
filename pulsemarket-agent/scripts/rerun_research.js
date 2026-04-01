import "dotenv/config";
import { getMarket } from "../src/marketApi.js";
import { researchMarket } from "../src/agent.js";

async function main() {
  const marketIdStr = process.argv[2];

  if (!marketIdStr) {
    console.error("Usage: node scripts/rerun_research.js <marketId>");
    process.exit(1);
  }

  const marketId = parseInt(marketIdStr, 10);
  if (!Number.isFinite(marketId)) {
    console.error(`Invalid marketId: ${marketIdStr}`);
    process.exit(1);
  }

  try {
    console.log(`[rerun_research] Fetching market ${marketId}...`);
    const market = await getMarket(marketId);

    console.log(
      `[rerun_research] Forcing AI research for market ${marketId}: \"${market.question}\"`,
    );
    const verdict = await researchMarket(market);

    console.log("[rerun_research] Done.");
    console.log(JSON.stringify(verdict, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("[rerun_research] Failed:", err);
    process.exit(1);
  }
}

main();
