import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { CHAIN_ID } from "../config/chain";

const AutoSignSessionContext = createContext(null);

function isSessionExpiredError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("authorization not found") ||
    msg.includes("session expired") ||
    msg.includes("grant expired") ||
    (msg.includes("expired") && msg.includes("autosign"))
  );
}

export function AutoSignSessionProvider({ children }) {
  const { autoSign, initiaAddress } = useInterwovenKit();
  const [sessionActive, setSessionActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    const enabled = Boolean(autoSign?.isEnabledByChain?.[CHAIN_ID]);
    setSessionActive(enabled);
  }, [autoSign?.isEnabledByChain]);

  useEffect(() => {
    if (!initiaAddress) {
      setSessionActive(false);
    }
  }, [initiaAddress]);

  const initializeSession = useCallback(async () => {
    if (sessionActive) return true;
    if (!initiaAddress) {
      throw new Error("Connect wallet first");
    }

    setIsInitializing(true);
    try {
      await autoSign?.enable(CHAIN_ID);
      setSessionActive(true);
      return true;
    } finally {
      setIsInitializing(false);
    }
  }, [autoSign, initiaAddress, sessionActive]);

  const clearSession = useCallback(async () => {
    try {
      await autoSign?.disable(CHAIN_ID);
    } catch {
      // Session might already be invalidated on chain.
    }
    setSessionActive(false);
  }, [autoSign]);

  const value = useMemo(
    () => ({
      sessionActive,
      isInitializing,
      initializeSession,
      clearSession,
      isSessionExpiredError,
    }),
    [clearSession, initializeSession, isInitializing, sessionActive],
  );

  return (
    <AutoSignSessionContext.Provider value={value}>
      {children}
    </AutoSignSessionContext.Provider>
  );
}

export function useAutoSignSession() {
  const ctx = useContext(AutoSignSessionContext);
  if (!ctx) {
    throw new Error(
      "useAutoSignSession must be used within AutoSignSessionProvider",
    );
  }
  return ctx;
}
