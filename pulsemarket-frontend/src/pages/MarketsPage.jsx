import { useMemo, useState } from "react";
import { useVerdicts } from "../hooks/useVerdicts";
import { FilterPills } from "../components/FilterPills";
import { MarketCard } from "../components/MarketCard";

export function MarketsPage({
  onOpenBet,
  markets,
  pendingMarketId,
  loading,
  error,
  onRefresh,
  isConnected,
  balanceMicro,
  balanceLoading,
  onOpenDeposit,
}) {
  const [category, setCategory] = useState("All");
  const {
    verdicts,
    loading: verdictsLoading,
    error: verdictsError,
  } = useVerdicts();
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
      {verdictsError && (
        <div className="mb-4 rounded-xl border border-[#7F1D1D] bg-[#2A1212] p-3 text-sm text-[#FECACA]">
          Failed to load AI verdicts: {verdictsError}
        </div>
      )}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {filtered.map((market) => (
          <MarketCard
            key={market.id}
            market={market}
            onBet={onOpenBet}
            verdict={verdicts[market.id]}
            pending={pendingMarketId === market.id}
          />
        ))}
      </div>
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
