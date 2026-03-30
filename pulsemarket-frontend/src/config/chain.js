export const CHAIN_ID = import.meta.env.VITE_CHAIN_ID || "micro-markets";
export const LCD_URL = import.meta.env.VITE_RPC_URL || "http://localhost:1317";
export const TENDERMINT_RPC_URL =
  import.meta.env.VITE_TENDERMINT_RPC_URL || "http://localhost:26657";
export const MODULE_ADDRESS = import.meta.env.VITE_MODULE_ADDRESS;
export const ORACLE_ADDRESS = import.meta.env.VITE_ORACLE_ADDRESS;
export const FEE_DENOM = import.meta.env.VITE_FEE_DENOM || "umin";

export const MODULE_NAME = "pulse_market";
export const APPCHAIN_NAME = CHAIN_ID;
export const L1_CHAIN_ID = import.meta.env.VITE_L1_CHAIN_ID || "initiation-2";
export const L1_LCD_URL =
  import.meta.env.VITE_L1_LCD_URL || "https://rest.testnet.initia.xyz";
export const L1_DENOM = import.meta.env.VITE_L1_DENOM || "uinit";
export const EXECUTOR_URL =
  import.meta.env.VITE_EXECUTOR_URL || "http://localhost:3000";
export const INDEXER_URL =
  import.meta.env.VITE_INDEXER_URL || "http://localhost:6767";
export const OP_BRIDGE_ID = import.meta.env.VITE_OP_BRIDGE_ID || "1725";

export const customChain = {
  chain_id: CHAIN_ID,
  chain_name: CHAIN_ID,
  pretty_name: "PulseMarket Local",
  network_type: "testnet",
  bech32_prefix: "init",
  logo_URIs: {
    png: "https://raw.githubusercontent.com/divin3circle/micro-prediction-markets/refs/heads/main/pulsemarket-frontend/assets/pulse-logo.png?token=GHSAT0AAAAAADV5Y62HVG5B3T4HEXFAEWAQ2OJ7CVQ",
    svg: "https://raw.githubusercontent.com/divin3circle/micro-prediction-markets/refs/heads/main/pulsemarket-frontend/assets/pulse-logo.png?token=GHSAT0AAAAAADV5Y62HD2LVXDQY24WGRUXA2OJWAXQ",
  },
  apis: {
    rpc: [{ address: TENDERMINT_RPC_URL }],
    rest: [{ address: LCD_URL }],
    indexer: [{ address: INDEXER_URL }],
  },
  fees: {
    fee_tokens: [
      {
        denom: FEE_DENOM,
        fixed_min_gas_price: 0,
        low_gas_price: 0,
        average_gas_price: 0,
        high_gas_price: 0,
      },
    ],
  },
  staking: {
    staking_tokens: [{ denom: FEE_DENOM }],
  },
  native_assets: [
    {
      denom: FEE_DENOM,
      name: "Initia Native Token",
      symbol: "INIT",
      decimals: 6,
    },
  ],
  metadata: {
    is_l1: false,
    op_bridge_id: OP_BRIDGE_ID,
    executor_uri: EXECUTOR_URL,
    minitia: { type: "minimove" },
  },
};
