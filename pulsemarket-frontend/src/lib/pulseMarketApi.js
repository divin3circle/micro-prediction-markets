import { RESTClient } from "@initia/initia.js";
import { useMemo } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import {
  CHAIN_ID,
  FEE_DENOM,
  LCD_URL,
  MODULE_ADDRESS,
  MODULE_NAME,
} from "../config/chain";
import { bcsAddress, bcsBool, bcsString, bcsU64 } from "./bcs";

const rest = new RESTClient(LCD_URL);

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
    status: Number(tuple[5]),
    outcome: Number(tuple[6]),
    totalYesAmount: Number(tuple[7]),
    totalNoAmount: Number(tuple[8]),
    createdAt: Number(tuple[9]),
  };
}

export async function getMarketCount() {
  const res = await rest.move.view(
    MODULE_ADDRESS,
    MODULE_NAME,
    "get_market_count",
    [],
    [],
  );
  return Number(parseViewData(res));
}

export async function getActiveMarketIds() {
  const res = await rest.move.view(
    MODULE_ADDRESS,
    MODULE_NAME,
    "get_active_market_ids",
    [],
    [],
  );
  const ids = parseViewData(res);
  return ids.map((id) => Number(id));
}

export async function getMarket(marketId) {
  const res = await rest.move.view(
    MODULE_ADDRESS,
    MODULE_NAME,
    "get_market",
    [],
    [bcsU64(marketId)],
  );
  return normalizeMarket(parseViewData(res));
}

export async function getUserPosition(marketId, userAddress) {
  const res = await rest.move.view(
    MODULE_ADDRESS,
    MODULE_NAME,
    "get_user_position",
    [],
    [bcsU64(marketId), bcsAddress(userAddress)],
  );
  const tuple = parseViewData(res);
  return {
    yesAmount: Number(tuple[0]),
    noAmount: Number(tuple[1]),
    claimed: Boolean(tuple[2]),
  };
}

export function usePulseMarketTx() {
  const { initiaAddress, requestTxSync, autoSign } = useInterwovenKit();

  const execute = useMemo(
    () => async (functionName, args) => {
      if (!initiaAddress) {
        throw new Error("Connect wallet first");
      }

      const enabled = autoSign?.isEnabledByChain?.[CHAIN_ID];
      if (!enabled) {
        await autoSign?.enable(CHAIN_ID, {
          permissions: ["/initia.move.v1.MsgExecute"],
        });
      }

      return requestTxSync({
        chainId: CHAIN_ID,
        autoSign: true,
        feeDenom: FEE_DENOM,
        messages: [
          {
            typeUrl: "/initia.move.v1.MsgExecute",
            value: {
              sender: initiaAddress,
              moduleAddress: MODULE_ADDRESS,
              moduleName: MODULE_NAME,
              functionName,
              typeArgs: [],
              args,
            },
          },
        ],
      });
    },
    [autoSign, initiaAddress, requestTxSync],
  );

  return {
    placeBet: ({ marketId, betYes, amount }) =>
      execute("place_bet", [bcsU64(marketId), bcsBool(betYes), bcsU64(amount)]),
    claimWinnings: (marketId) => execute("claim_winnings", [bcsU64(marketId)]),
    claimRefund: (marketId) => execute("claim_refund", [bcsU64(marketId)]),
    createMarket: ({ question, category, closeTime, resolveTime }) =>
      execute("create_market", [
        bcsString(question),
        bcsString(category),
        bcsU64(closeTime),
        bcsU64(resolveTime),
      ]),
    closeMarket: (marketId) => execute("close_market", [bcsU64(marketId)]),
    resolveMarket: ({ marketId, yesWon }) =>
      execute("resolve_market", [bcsU64(marketId), bcsBool(yesWon)]),
  };
}
