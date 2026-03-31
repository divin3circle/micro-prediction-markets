import { useCallback, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";

export function useBetModal() {
  const { initiaAddress, openConnect } = useInterwovenKit();
  const [betState, setBetState] = useState({
    open: false,
    market: null,
    side: true,
  });

  const openBet = useCallback(
    (market, side) => {
      if (!initiaAddress) {
        openConnect?.();
        return;
      }
      setBetState({ open: true, market, side });
    },
    [initiaAddress, openConnect],
  );

  const closeBet = useCallback(
    () => setBetState({ open: false, market: null, side: true }),
    [],
  );

  return {
    betState,
    openBet,
    closeBet,
  };
}
