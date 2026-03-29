export const CHAIN_ID = import.meta.env.VITE_CHAIN_ID;
export const LCD_URL = import.meta.env.VITE_RPC_URL;
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

export const customChain = {
  chain_id: CHAIN_ID,
  chain_name: CHAIN_ID,
  pretty_name: "PulseMarket Local",
  network_type: "testnet",
  bech32_prefix: "init",
  logo_URIs: {
    png: "https://raw.githubusercontent.com/initia-labs/initia-registry/main/testnets/initia/images/initia.png",
    svg: "https://raw.githubusercontent.com/initia-labs/initia-registry/main/testnets/initia/images/initia.svg",
  },
  apis: {
    rpc: [{ address: TENDERMINT_RPC_URL }],
    rest: [{ address: LCD_URL }],
    indexer: [{ address: "http://localhost:8080" }],
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
      name: "INIT",
      symbol: "INIT",
      decimals: 6,
    },
  ],
  metadata: {
    is_l1: false,
    executor_uri: EXECUTOR_URL,
    minitia: { type: "minimove" },
  },
};
