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
import { ORACLE_ADDRESS } from "./config/chain";
import { usePulseMarkets, useUserPositions } from "./hooks/usePulseMarkets";
import {
  getMarket,
  getMarketCount,
  usePulseMarketTx,
} from "./lib/pulseMarketApi";

function MarketsPage({ onOpenBet, markets, loading, error, onRefresh }) {
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
  const navigate = useNavigate();
  const { initiaAddress, openConnect } = useInterwovenKit();
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

  const setFlash = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2800);
  }, []);

  const isAdmin = useMemo(() => {
    if (!initiaAddress || !ORACLE_ADDRESS) return false;
    return initiaAddress.toLowerCase() === ORACLE_ADDRESS.toLowerCase();
  }, [initiaAddress]);

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
    async (runner, successMessage) => {
      try {
        await runner();
        await Promise.all([refresh(), refreshPositions()]);
        setFlash(successMessage);
        return true;
      } catch (e) {
        setFlash(e?.message || "Transaction failed");
        return false;
      }
    },
    [refresh, refreshPositions, setFlash],
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

  useEffect(() => {
    if (isAdmin) {
      refreshAdmin().catch(() => {});
    }
  }, [isAdmin, refreshAdmin]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(124,92,252,0.22),transparent_48%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.12),transparent_52%),linear-gradient(180deg,#0A0A0E_0%,#050507_100%)]" />
      <TopNav />
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
              />
            }
          />
          <Route
            path="/positions"
            element={
              <PositionsView
                positions={positions}
                loading={loadingPositions}
                onClaimWin={(id) =>
                  runAndSync(
                    () => tx.claimWinnings(id),
                    "Winnings claimed successfully",
                  )
                }
                onClaimRefund={(id) =>
                  runAndSync(() => tx.claimRefund(id), "Refund claimed")
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
                onCreateMarket={async (payload) => {
                  const ok = await runAndSync(
                    () => tx.createMarket(payload),
                    "Market created",
                  );
                  if (ok) {
                    await refreshAdmin();
                  }
                }}
                onCloseMarket={async (marketId) => {
                  const ok = await runAndSync(
                    () => tx.closeMarket(marketId),
                    `Market #${marketId} closed`,
                  );
                  if (ok) {
                    await refreshAdmin();
                  }
                }}
                onResolve={async ({ marketId, yesWon }) => {
                  const ok = await runAndSync(
                    () => tx.resolveMarket({ marketId, yesWon }),
                    `Market #${marketId} resolved`,
                  );
                  if (ok) {
                    await refreshAdmin();
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
        onClose={closeBet}
        onPlace={async (payload) => {
          await runAndSync(() => tx.placeBet(payload), "Bet placed");
        }}
      />
    </div>
  );
}

export default App;
