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

function calculatePotentialPayout(market, position) {
  const feeBps = 200; // 2%
  const totalPool = market.totalYesAmount + market.totalNoAmount;
  if (totalPool === 0) return 0;

  // Calculate fee and net pool
  const fee = Math.floor((totalPool * feeBps) / 10000);
  const netPool = totalPool - fee;

  let potentialPayout = 0;

  // If they have YES position and YES wins
  if (position.yesAmount > 0 && market.totalYesAmount > 0) {
    potentialPayout = Math.floor(
      (netPool * position.yesAmount) / market.totalYesAmount
    );
  }

  // If they have NO position and NO wins
  if (position.noAmount > 0 && market.totalNoAmount > 0) {
    potentialPayout = Math.floor(
      (netPool * position.noAmount) / market.totalNoAmount
    );
  }

  return potentialPayout;
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
      {positions.reverse().map(({ market, position }) => {
        const status = statusLabel(market);
        const isWinner =
          (market.outcome === 1 && position.yesAmount > 0) ||
          (market.outcome === 2 && position.noAmount > 0);
        const canRefund =
          market.status === 2 &&
          ((market.outcome === 1 && market.totalYesAmount === 0) ||
            (market.outcome === 2 && market.totalNoAmount === 0));
        
        const potentialPayout = calculatePotentialPayout(market, position);
        const totalBet = position.yesAmount + position.noAmount;
        const profitLoss = potentialPayout - totalBet;
        const profitColor = profitLoss >= 0 ? "text-[#22C55E]" : "text-[#EF4444]";

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

            {(market.status === 0 || market.status === 1) && !position.claimed && (
              <div className="mb-3 rounded-xl border border-[#2A2A35] bg-[#0D0D0F] px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">
                      Potential payout
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {toInit(potentialPayout)} INIT
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">
                      P&L
                    </p>
                    <p className={`mt-1 text-sm font-semibold ${profitColor}`}>
                      {profitLoss >= 0 ? "+" : ""}{toInit(profitLoss)} INIT
                    </p>
                  </div>
                </div>
              </div>
            )}

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
