import { RESTClient, MnemonicKey, LCDClient, MsgExecute } from "@initia/initia.js";
import "dotenv/config";

export const CHAIN_ID = process.env.CHAIN_ID || "micro-markets";
export const LCD_URL = process.env.LCD_URL || "http://localhost:1317";
export const MODULE_ADDRESS = process.env.MODULE_ADDRESS;
export const MODULE_NAME = process.env.MODULE_NAME || "pulse_market";
export const FEE_DENOM = process.env.FEE_DENOM || "umin";
export const TENDERMINT_RPC_URL = process.env.TENDERMINT_RPC_URL || "http://localhost:26657";

if (!MODULE_ADDRESS) {
  throw new Error("MODULE_ADDRESS is required in .env");
}

// REST client for reading chain state
export const rest = new RESTClient(LCD_URL);

// LCD client for broadcasting transactions
export const lcd = new LCDClient(LCD_URL, {
  chainID: CHAIN_ID,
  gasPrices: `0${FEE_DENOM}`,
});

/** Build the oracle wallet from the mnemonic in .env */
export function getOracleWallet() {
  const mnemonic = process.env.ORACLE_MNEMONIC;
  if (!mnemonic) {
    throw new Error("ORACLE_MNEMONIC is required in .env");
  }
  const key = new MnemonicKey({ mnemonic });
  return lcd.wallet(key);
}

export { MsgExecute };
