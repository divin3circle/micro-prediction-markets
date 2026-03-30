import { useCallback, useEffect, useState } from "react";
import { L1_CHAIN_ID, L1_DENOM } from "../config/chain";
import {
  getCreationFee,
  getL1InitBalance,
  getNativeBalance,
} from "../lib/pulseMarketApi";

export function useBalances({ initiaAddress, openConnect, openBridge, setFlash }) {
  const [creationFee, setCreationFee] = useState(100_000);
  const [balanceMicro, setBalanceMicro] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [hasLoadedBalance, setHasLoadedBalance] = useState(false);
  const [l1BalanceMicro, setL1BalanceMicro] = useState(null);
  const [l1BalanceLoading, setL1BalanceLoading] = useState(false);
  const [hasLoadedL1Balance, setHasLoadedL1Balance] = useState(false);
  const [depositPending, setDepositPending] = useState(false);
  const [bridgeStartBalance, setBridgeStartBalance] = useState(null);

  const refreshBalance = useCallback(
    async (showSkeleton = false) => {
      if (!initiaAddress) {
        setBalanceMicro(null);
        setBalanceLoading(false);
        return null;
      }
      if (showSkeleton && !hasLoadedBalance) {
        setBalanceLoading(true);
      }
      try {
        const next = await getNativeBalance(initiaAddress);
        setBalanceMicro(next);
        setHasLoadedBalance(true);
        return next;
      } catch {
        return null;
      } finally {
        setBalanceLoading(false);
      }
    },
    [hasLoadedBalance, initiaAddress],
  );

  const refreshL1Balance = useCallback(
    async (showSkeleton = false) => {
      if (!initiaAddress) {
        setL1BalanceMicro(null);
        setL1BalanceLoading(false);
        return null;
      }
      if (showSkeleton && !hasLoadedL1Balance) {
        setL1BalanceLoading(true);
      }
      try {
        const next = await getL1InitBalance(initiaAddress);
        setL1BalanceMicro(next);
        setHasLoadedL1Balance(true);
        return next;
      } catch {
        return null;
      } finally {
        setL1BalanceLoading(false);
      }
    },
    [hasLoadedL1Balance, initiaAddress],
  );

  const openDepositBridge = useCallback(async () => {
    if (!initiaAddress) {
      openConnect?.();
      return;
    }
    const baseline = await refreshBalance(true);
    setBridgeStartBalance(typeof baseline === "number" ? baseline : 0);
    setDepositPending(true);
    try {
      openBridge?.({
        srcChainId: L1_CHAIN_ID,
        srcDenom: L1_DENOM,
      });
    } catch (e) {
      setDepositPending(false);
      setFlash(e?.message || "Failed to open deposit flow");
    }
  }, [initiaAddress, openConnect, openBridge, refreshBalance, setFlash]);

  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      try {
        const fee = await getCreationFee();
        if (!mounted) return;
        setCreationFee(Number.isFinite(fee) ? fee : 100_000);
      } catch {
        if (!mounted) return;
        setCreationFee(100_000);
      }
    };
    loadConfig();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!initiaAddress) {
      setBalanceMicro(null);
      setHasLoadedBalance(false);
      setL1BalanceMicro(null);
      setHasLoadedL1Balance(false);
      return;
    }

    refreshBalance(true);
    refreshL1Balance(true);
    const timer = setInterval(() => {
      refreshBalance(false);
      refreshL1Balance(false);
    }, 30000);

    return () => clearInterval(timer);
  }, [initiaAddress, refreshBalance, refreshL1Balance]);

  useEffect(() => {
    if (!depositPending || !initiaAddress) return;

    const timer = setInterval(async () => {
      const next = await refreshBalance(false);
      if (
        typeof next === "number" &&
        typeof bridgeStartBalance === "number" &&
        next > bridgeStartBalance
      ) {
        setDepositPending(false);
        setBridgeStartBalance(next);
        setFlash("Deposit confirmed — you're ready to bet!");
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [
    depositPending,
    bridgeStartBalance,
    initiaAddress,
    refreshBalance,
    setFlash,
  ]);

  return {
    creationFee,
    balanceMicro,
    balanceLoading,
    hasLoadedBalance,
    l1BalanceMicro,
    l1BalanceLoading,
    hasLoadedL1Balance,
    depositPending,
    openDepositBridge,
  };
}
