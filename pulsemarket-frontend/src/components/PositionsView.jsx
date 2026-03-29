import { UserDisplay } from "./UserDisplay";

function statusLabel(market) {
  if (market.status === 0)
    return { text: "Open", cls: "bg-[#7C5CFC] text-white" };
  if (market.status === 1)
    return { text: "Closed", cls: "bg-[#30303A] text-[#C2C2CE]" };
  if (market.outcome === 1)
    return { text: "Resolved YES", cls: "bg-[#14532D] text-[#86EFAC]" };
  return { text: "Resolved NO", cls: "bg-[#7F1D1D] text-[#FCA5A5]" };
}

function toInit(v) {
  return (v / 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export function PositionsView({
  positions,
  onClaimWin,
  onClaimRefund,
  loading,
  currentAddress,
}) {
  if (loading) return <p className="text-[#A1A1B0]">Loading positions...</p>;
  if (!positions.length) {
    return <p className="text-[#A1A1B0]">You haven't placed any bets yet.</p>;
  }

  return (
    <div className="space-y-3">
      {currentAddress && (
        <div className="rounded-xl bg-[#101015] px-3 py-2 text-xs text-[#A1A1B0]">
          Account:{" "}
          <UserDisplay address={currentAddress} className="text-[#E5E7EB]" />
        </div>
      )}
      {positions.map(({ market, position }) => {
        const status = statusLabel(market);
        const isWinner =
          (market.outcome === 1 && position.yesAmount > 0) ||
          (market.outcome === 2 && position.noAmount > 0);
        const canRefund =
          market.status === 2 &&
          ((market.outcome === 1 && market.totalYesAmount === 0) ||
            (market.outcome === 2 && market.totalNoAmount === 0));

        return (
          <div
            key={market.id}
            className="rounded-2xl bg-[#16161A] p-4 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-white">
                {market.question}
              </h3>
              <span className={`rounded-full px-2 py-1 text-xs ${status.cls}`}>
                {status.text}
              </span>
            </div>

            <div className="mb-3 flex gap-4 text-sm">
              <p className="text-[#22C55E]">
                YES: {toInit(position.yesAmount)} INIT
              </p>
              <p className="text-[#EF4444]">
                NO: {toInit(position.noAmount)} INIT
              </p>
            </div>

            {market.status === 2 && !position.claimed && isWinner && (
              <button
                type="button"
                className="rounded-lg bg-[#166534] px-3 py-2 text-sm text-white"
                onClick={() => onClaimWin(market.id)}
              >
                Claim Winnings
              </button>
            )}
            {market.status === 2 && !position.claimed && canRefund && (
              <button
                type="button"
                className="rounded-lg bg-[#A16207] px-3 py-2 text-sm text-white"
                onClick={() => onClaimRefund(market.id)}
              >
                Claim Refund
              </button>
            )}
            {position.claimed && (
              <button
                type="button"
                disabled
                className="rounded-lg bg-[#2A2A35] px-3 py-2 text-sm text-[#9CA3AF]"
              >
                Claimed ✓
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
