import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { FilterPills } from "./components/FilterPills";
import { MarketCard } from "./components/MarketCard";
import { TopNav } from "./components/TopNav";
import { BetModal } from "./components/BetModal";
import { Toast } from "./components/Toast";
import { PositionsView } from "./components/PositionsView";
import { AdminView } from "./components/AdminView";
import { CreateMarketView } from "./components/CreateMarketView";
import { BridgeModal } from "./components/BridgeModal";
import {
  CHAIN_ID,
  FEE_DENOM,
  L1_CHAIN_ID,
  ORACLE_ADDRESS,
} from "./config/chain";
import { usePulseMarkets, useUserPositions } from "./hooks/usePulseMarkets";
import {
  AutoSignSessionProvider,
  useAutoSignSession,
} from "./context/AutoSignSessionContext";
import {
  getCreationFee,
  getMarket,
  getMarketCount,
  getNativeBalance,
  getOracleAddress,
  usePulseMarketTx,
} from "./lib/pulseMarketApi";

function MarketsPage({
  onOpenBet,
  markets,
  loading,
  error,
  onRefresh,
  isConnected,
  balanceMicro,
  balanceLoading,
  onOpenDeposit,
}) {
  const [category, setCategory] = useState("All");
  const filtered = useMemo(
    () =>
      category === "All"
        ? markets
        : markets.filter((m) => m.category.toLowerCase() === category),
    [category, markets],
  );

  return (
    <>
      <FilterPills value={category} onChange={setCategory} />
      {loading && <p className="text-sm text-[#A1A1B0]">Loading markets...</p>}
      {error && (
        <div className="mb-4 rounded-xl border border-[#7F1D1D] bg-[#2A1212] p-3 text-sm text-[#FECACA]">
          {error}
        </div>
      )}
      {isConnected && !balanceLoading && balanceMicro === 0 && (
        <div className="mb-4 rounded-xl border border-[#3B2C0F] bg-[#2A1D08] px-4 py-3 text-sm text-[#FDE68A]">
          <span>
            You have no INIT on micro-markets. Deposit to start betting.{" "}
          </span>
          <button
            type="button"
            onClick={onOpenDeposit}
            className="font-semibold text-[#FACC15] underline-offset-2 hover:underline"
          >
            {"Deposit now ->"}
          </button>
        </div>
      )}
      {!loading && !filtered.length && (
        <div className="rounded-2xl bg-[#16161A] p-6 text-center text-sm text-[#A1A1B0]">
          No active markets found in this category.
        </div>
      )}
      {filtered.map((market) => (
        <MarketCard key={market.id} market={market} onBet={onOpenBet} />
      ))}
      <button
        type="button"
        onClick={onRefresh}
        className="mt-3 rounded-xl border border-[#2A2A35] px-4 py-2 text-sm text-[#D1D5DB]"
      >
        Refresh
      </button>
    </>
  );
}

function App() {
  return (
    <AutoSignSessionProvider>
      <AppShell />
    </AutoSignSessionProvider>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const { initiaAddress, openConnect } = useInterwovenKit();
  const {
    sessionActive,
    initializeSession,
    clearSession,
    isInitializing,
    isSessionExpiredError,
  } = useAutoSignSession();
  const tx = usePulseMarketTx();
  const { markets, loading, error, refresh } = usePulseMarkets();
  const {
    positions,
    loading: loadingPositions,
    refresh: refreshPositions,
  } = useUserPositions(initiaAddress);

  const [betState, setBetState] = useState({
    open: false,
    market: null,
    side: true,
  });
  const [toast, setToast] = useState("");
  const [oracleAddress, setOracleAddress] = useState(ORACLE_ADDRESS || "");
  const [creationFee, setCreationFee] = useState(100_000);
  const [balanceMicro, setBalanceMicro] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [hasLoadedBalance, setHasLoadedBalance] = useState(false);
  const [bridgeOpen, setBridgeOpen] = useState(false);
  const [bridgeStartBalance, setBridgeStartBalance] = useState(null);

  const setFlash = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2800);
  }, []);

  const isAdmin = useMemo(() => {
    if (!initiaAddress || !oracleAddress) return false;
    return initiaAddress.toLowerCase() === oracleAddress.toLowerCase();
  }, [initiaAddress, oracleAddress]);

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
        await Promise.all([refresh(), refreshPositions()]);
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
      refresh,
      refreshPositions,
      sessionActive,
      setFlash,
    ],
  );

  const fetchAllMarkets = useCallback(async () => {
    const count = await getMarketCount();
    const ids = Array.from({ length: count }, (_, i) => i);
    const all = await Promise.all(ids.map((id) => getMarket(id)));
    return all.sort((a, b) => b.id - a.id);
  }, []);

  const [adminMarkets, setAdminMarkets] = useState([]);
  const refreshAdmin = useCallback(async () => {
    const all = await fetchAllMarkets();
    setAdminMarkets(all);
  }, [fetchAllMarkets]);

  const ensureAdminMarkets = useCallback(async () => {
    if (!adminMarkets.length) {
      await refreshAdmin();
    }
  }, [adminMarkets.length, refreshAdmin]);

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

  const openDepositBridge = useCallback(async () => {
    if (!initiaAddress) {
      openConnect?.();
      return;
    }
    const baseline = await refreshBalance(true);
    setBridgeStartBalance(typeof baseline === "number" ? baseline : 0);
    setBridgeOpen(true);
  }, [initiaAddress, openConnect, refreshBalance]);

  useEffect(() => {
    if (isAdmin) {
      refreshAdmin().catch(() => {});
    }
  }, [isAdmin, refreshAdmin]);

  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      try {
        const [oracle, fee] = await Promise.all([
          getOracleAddress(),
          getCreationFee(),
        ]);
        if (!mounted) return;
        setOracleAddress(oracle || ORACLE_ADDRESS || "");
        setCreationFee(Number.isFinite(fee) ? fee : 100_000);
      } catch {
        if (!mounted) return;
        setOracleAddress(ORACLE_ADDRESS || "");
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
      return;
    }

    refreshBalance(true);
    const timer = setInterval(() => {
      refreshBalance(false);
    }, 30000);

    return () => clearInterval(timer);
  }, [initiaAddress, refreshBalance]);

  useEffect(() => {
    if (!bridgeOpen || !initiaAddress) return;

    const timer = setInterval(async () => {
      const next = await refreshBalance(false);
      if (
        typeof next === "number" &&
        typeof bridgeStartBalance === "number" &&
        next > bridgeStartBalance
      ) {
        setBridgeOpen(false);
        setBridgeStartBalance(next);
        setFlash("Deposit confirmed — you're ready to bet!");
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [bridgeOpen, bridgeStartBalance, initiaAddress, refreshBalance, setFlash]);

  const bridgeDefaults = useMemo(
    () => ({
      srcChainId: L1_CHAIN_ID,
      srcDenom: "uinit",
      dstChainId: CHAIN_ID,
      dstDenom: FEE_DENOM,
    }),
    [],
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(124,92,252,0.22),transparent_48%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.12),transparent_52%),linear-gradient(180deg,#0A0A0E_0%,#050507_100%)]" />
      <TopNav
        autoSignActive={sessionActive}
        autoSignLoading={isInitializing}
        onOpenDeposit={openDepositBridge}
        balanceMicro={balanceMicro}
        balanceLoading={balanceLoading && !hasLoadedBalance}
        onEnableAutoSign={async () => {
          if (!initiaAddress) {
            openConnect?.();
            return;
          }
          try {
            setFlash(
              "Allow PulseMarket to place bets on your behalf during this session",
            );
            await initializeSession();
            setFlash("Auto-signing active");
          } catch (e) {
            setFlash(e?.message || "Failed to enable auto-signing");
          }
        }}
      />
      <Toast message={toast} />

      <main className="mx-auto w-full max-w-[980px] px-4 pb-24 pt-6">
        <Routes>
          <Route
            path="/"
            element={
              <MarketsPage
                onOpenBet={openBet}
                markets={markets}
                loading={loading}
                error={error}
                onRefresh={refresh}
                isConnected={Boolean(initiaAddress)}
                balanceMicro={balanceMicro}
                balanceLoading={balanceLoading}
                onOpenDeposit={openDepositBridge}
              />
            }
          />
          <Route
            path="/positions"
            element={
              <PositionsView
                positions={positions}
                loading={loadingPositions}
                currentAddress={initiaAddress}
                onClaimWin={(id) =>
                  runAndSync(
                    () => tx.claimWinnings(id),
                    "Winnings claimed successfully",
                    { requiresAutoSign: true },
                  )
                }
                onClaimRefund={(id) =>
                  runAndSync(() => tx.claimRefund(id), "Refund claimed", {
                    requiresAutoSign: true,
                  })
                }
              />
            }
          />
          <Route
            path="/admin"
            element={
              <AdminView
                isAdmin={isAdmin}
                allMarkets={adminMarkets}
                oracleAddress={oracleAddress}
                onCreateMarket={async (payload) => {
                  const ok = await runAndSync(
                    () => tx.createMarket(payload),
                    "Market created",
                    { requiresAutoSign: false },
                  );
                  if (ok) {
                    await refreshAdmin();
                  }
                }}
                onCloseMarket={async (marketId) => {
                  const ok = await runAndSync(
                    () => tx.closeMarket(marketId),
                    `Market #${marketId} closed`,
                    { requiresAutoSign: false },
                  );
                  if (ok) {
                    await refreshAdmin();
                  }
                }}
                onResolve={async ({ marketId, yesWon }) => {
                  const ok = await runAndSync(
                    () => tx.resolveMarket({ marketId, yesWon }),
                    `Market #${marketId} resolved`,
                    { requiresAutoSign: false },
                  );
                  if (ok) {
                    await refreshAdmin();
                  }
                }}
              />
            }
          />
          <Route
            path="/create"
            element={
              <CreateMarketView
                initiaAddress={initiaAddress}
                creationFee={creationFee}
                onConnect={openConnect}
                onCreateMarket={async (payload) => {
                  const ok = await runAndSync(
                    () => tx.createMarket(payload),
                    "Market created",
                    { requiresAutoSign: false },
                  );
                  if (ok) {
                    await refreshAdmin();
                    navigate("/");
                  }
                }}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {isAdmin && (
          <button
            type="button"
            onClick={async () => {
              await ensureAdminMarkets();
              navigate("/admin");
            }}
            className="fixed bottom-6 right-4 rounded-full bg-[#7C5CFC] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_30px_rgba(124,92,252,0.35)]"
          >
            Admin Panel
          </button>
        )}
      </main>

      <BetModal
        open={betState.open}
        market={betState.market}
        initialSide={betState.side}
        connectedAddress={initiaAddress}
        onClose={closeBet}
        onPlace={async (payload) => {
          const { onAutoSignStart, onTxStart, ...txPayload } = payload;
          if (!sessionActive) {
            onAutoSignStart?.();
            setFlash(
              "Allow PulseMarket to place bets on your behalf during this session",
            );
            await initializeSession();
          }
          onTxStart?.();
          await runAndSync(() => tx.placeBet(txPayload), "Bet placed", {
            requiresAutoSign: true,
            skipAutoSignInit: true,
          });
        }}
      />

      <BridgeModal
        open={bridgeOpen}
        onClose={() => setBridgeOpen(false)}
        bridgeDefaults={bridgeDefaults}
      />
    </div>
  );
}

export default App;
