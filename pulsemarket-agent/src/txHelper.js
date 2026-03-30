import {
  getOracleWallet,
  lcd,
  MODULE_ADDRESS,
  MODULE_NAME,
  FEE_DENOM,
  CHAIN_ID,
  MsgExecute,
} from "./chain.js";
import { Fee } from "@initia/initia.js";
import { logError } from "./errorLogging.js";

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

function resolveSenderAddress(key) {
  if (!key) throw new Error("Missing wallet key");

  if (typeof key.accAddress === "function") {
    return key.accAddress("init");
  }

  if (typeof key.accAddress === "string" && key.accAddress.length > 0) {
    return key.accAddress;
  }

  if (typeof key.address === "function") {
    return key.address();
  }

  if (typeof key.address === "string" && key.address.length > 0) {
    return key.address;
  }

  throw new Error("Unable to resolve sender address from wallet key");
}

/**
 * Build and broadcast a MsgExecute transaction.
 * Returns the tx hash on success, throws on failure.
 */
async function executeTx(functionName, args) {
  try {
    const wallet = getOracleWallet();

    await wallet.accountNumberAndSequence();
    const key = wallet.key;
    const address = resolveSenderAddress(key);

    const msg = new MsgExecute(
      address,
      MODULE_ADDRESS,
      MODULE_NAME,
      functionName,
      [],
      args,
    );

    const tx = await wallet.createAndSignTx({
      msgs: [msg],
      fee: new Fee(400000, `0${FEE_DENOM}`),
      memo: `pulsemarket-agent: ${functionName}`,
    });

    const result = await lcd.tx.broadcast(tx);

    if (result.code !== 0) {
      const error = new Error(
        `Tx failed (code ${result.code}): ${result.raw_log}`,
      );
      error.txResult = result;
      throw error;
    }

    console.log(`[txHelper] ${functionName} → txhash: ${result.txhash}`);
    return result.txhash;
  } catch (err) {
    logError("[txHelper] executeTx failed", err, {
      functionName,
      chainId: CHAIN_ID,
      moduleAddress: MODULE_ADDRESS,
      moduleName: MODULE_NAME,
      feeDenom: FEE_DENOM,
      argsCount: args.length,
      txResult: err?.txResult,
    });
    throw err;
  }
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
