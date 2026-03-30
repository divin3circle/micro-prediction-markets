import { getOracleWallet, lcd, MODULE_ADDRESS, MODULE_NAME, FEE_DENOM, CHAIN_ID } from "./chain.js";

/**
 * BCS encode a u64 number to little-endian 8 bytes, base64 encoded.
 */
function bcsU64(n) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
  return buf.toString("base64");
}

/**
 * BCS encode a bool.
 */
function bcsBool(b) {
  return Buffer.from([b ? 1 : 0]).toString("base64");
}

/**
 * Build and broadcast a MsgExecute transaction.
 * Returns the tx hash on success, throws on failure.
 */
async function executeTx(functionName, args) {
  const wallet = getOracleWallet();

  const [account] = await wallet.accountNumberAndSequence();
  const key = wallet.key;
  const address = key.accAddress("init");

  const msg = {
    "@type": "/initia.move.v1.MsgExecute",
    sender: address,
    module_address: MODULE_ADDRESS,
    module_name: MODULE_NAME,
    function_name: functionName,
    type_args: [],
    args,
  };

  const tx = await wallet.createAndSignTx({
    msgs: [msg],
    fee: {
      amount: [{ denom: FEE_DENOM, amount: "0" }],
      gas: "400000",
    },
    memo: `pulsemarket-agent: ${functionName}`,
  });

  const result = await lcd.tx.broadcast(tx);

  if (result.code !== 0) {
    throw new Error(`Tx failed (code ${result.code}): ${result.raw_log}`);
  }

  console.log(`[txHelper] ${functionName} → txhash: ${result.txhash}`);
  return result.txhash;
}

/**
 * Close a market (anyone can call once closeTime is past).
 */
export async function closeMarket(marketId) {
  return executeTx("close_market", [bcsU64(marketId)]);
}

/**
 * Resolve a market (only oracle can call).
 * @param {number} marketId
 * @param {boolean} yesWon
 */
export async function resolveMarket(marketId, yesWon) {
  return executeTx("resolve_market", [bcsU64(marketId), bcsBool(yesWon)]);
}
