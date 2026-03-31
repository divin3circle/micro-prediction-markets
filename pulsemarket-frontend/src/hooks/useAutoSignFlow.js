import { useCallback, useRef } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";

export function useAutoSignFlow() {
  const { initiaAddress, openConnect } = useInterwovenKit();
  const isAutoSignInitRef = useRef(false);

  const prepareAutoSign = useCallback(
    async ({ initializeSession, setFlash }) => {
      if (!initiaAddress) {
        openConnect?.();
        return false;
      }

      if (!isAutoSignInitRef.current) {
        try {
          setFlash(
            "Allow PulseMarket to place bets on your behalf during this session",
          );
          await initializeSession();
          isAutoSignInitRef.current = true;
        } catch (e) {
          setFlash(e?.message || "Failed to enable auto-signing");
          return false;
        }
      }
      return true;
    },
    [initiaAddress, openConnect],
  );

  const resetAutoSign = useCallback(() => {
    isAutoSignInitRef.current = false;
  }, []);

  return { initiaAddress, prepareAutoSign, resetAutoSign };
}
