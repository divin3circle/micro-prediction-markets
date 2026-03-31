import "dotenv/config";
import { resolveMarket } from "../src/txHelper.js";

async function main() {
  const marketIdStr = process.argv[2];
  const outcomeStr = process.argv[3];

  if (!marketIdStr || !outcomeStr) {
    console.error("Usage: node scripts/resolve_market.js <marketId> <YES|NO>");
    process.exit(1);
  }

  const marketId = parseInt(marketIdStr, 10);
  const outcomeYes = outcomeStr.toUpperCase() === "YES";

  console.log(`Resolving Market ${marketId} -> ${outcomeYes ? 'YES' : 'NO'}`);
  try {
    const txHash = await resolveMarket(marketId, outcomeYes);
    console.log(`Success! Transaction Hash: ${txHash}`);
    process.exit(0);
  } catch (err) {
    console.error(`Failed to resolve market:`, err);
    process.exit(1);
  }
}

main();