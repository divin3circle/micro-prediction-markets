import { useCallback } from "react";
import { useAutoSignSession } from "../context/AutoSignSessionContext";

export function useTransactionActions({
  setFlash,
  refreshMarkets,
  refreshPositions,
}) {
  const {
    sessionActive,
    initializeSession,
    clearSession,
    isSessionExpiredError,
  } = useAutoSignSession();

  const runAndSync = useCallback(
    async (
      runner,
      successMessage,
      options = { requiresAutoSign: false, skipAutoSignInit: false },
    ) => {
      const { requiresAutoSign = false, skipAutoSignInit = false } = options;
      try {
        if (requiresAutoSign && !skipAutoSignInit && !sessionActive) {
          setFlash(
            "Allow PulseMarket to place bets on your behalf during this session",
          );
          await initializeSession();
        }
        await runner();
        await Promise.all([refreshMarkets(), refreshPositions()]);
        setFlash(successMessage);
        return true;
      } catch (e) {
        if (requiresAutoSign && isSessionExpiredError(e)) {
          await clearSession();
          setFlash("Session expired — tap ⚡ to re-enable auto-signing");
          return false;
        }
        setFlash(e?.message || "Transaction failed");
        return false;
      }
    },
    [
      clearSession,
      initializeSession,
      isSessionExpiredError,
      refreshMarkets,
      refreshPositions,
      sessionActive,
      setFlash,
    ],
  );

  return {
    runAndSync,
    sessionActive,
    initializeSession,
    clearSession,
    isSessionExpiredError,
  };
}
