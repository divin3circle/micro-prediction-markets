import { useEffect, useMemo, useState } from "react";

const YES_COLOR = "#22C55E";
const NO_COLOR = "#EF4444";

function formatInit(micro) {
  return (micro / 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function formatDateTime(sec) {
  return new Date(sec * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function useCountdown(closeTime) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const remain = closeTime - now;
  if (remain <= 0) return "Closed";
  const h = Math.floor(remain / 3600);
  const m = Math.floor((remain % 3600) / 60);
  const s = remain % 60;
  return `${h}h ${m}m ${s}s`;
}

export function MarketCard({ market, onBet }) {
  const countdown = useCountdown(market.closeTime);
  const pool = market.totalYesAmount + market.totalNoAmount;
  const yesPct = useMemo(() => {
    if (!pool) return 50;
    return (market.totalYesAmount / pool) * 100;
  }, [market.totalYesAmount, pool]);
  const noPct = 100 - yesPct;

  // Calculate odds multiplier (payout ratio)
  const yesOdds = useMemo(() => {
    if (market.totalYesAmount === 0 && market.totalNoAmount === 0) return 2.0;
    if (market.totalYesAmount === 0) return pool > 0 ? "High" : 2.0; // If some NO but no YES, YES odds are very high

    // Total pool after 2% fee
    const feeBps = 200;
    const fee = Math.floor((pool * feeBps) / 10000);
    const netPool = pool - fee;

    // What you get back for 1 unit bet (including the unit itself)
    return (netPool / market.totalYesAmount).toFixed(2);
  }, [market.totalYesAmount, market.totalNoAmount, pool]);

  const noOdds = useMemo(() => {
    if (market.totalYesAmount === 0 && market.totalNoAmount === 0) return 2.0;
    if (market.totalNoAmount === 0) return pool > 0 ? "High" : 2.0; // If some YES but no NO, NO odds are very high

    // Total pool after 2% fee
    const feeBps = 200;
    const fee = Math.floor((pool * feeBps) / 10000);
    const netPool = pool - fee;

    // What you get back for 1 unit bet (including the unit itself)
    return (netPool / market.totalNoAmount).toFixed(2);
  }, [market.totalYesAmount, market.totalNoAmount, pool]);

  const isUrgent = market.closeTime - Math.floor(Date.now() / 1000) < 300;

  return (
    <article className="mb-4 rounded-2xl bg-[#16161A] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-[#232334] px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-[#B7B7C8]">
          {market.category}
        </span>
        <span
          className={`text-xs ${isUrgent ? "text-[#EF4444]" : "text-[#9CA3AF]"}`}
        >
          {countdown}
        </span>
      </div>

      <h3 className="mb-4 text-[18px] font-semibold text-white">
        {market.question}
      </h3>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#0D0D0F]">
        <div className="flex h-full w-full">
          <div
            style={{ width: `${yesPct}%`, backgroundColor: YES_COLOR }}
            className="transition-[width] duration-300 ease-in-out"
          />
          <div
            style={{ width: `${noPct}%`, backgroundColor: NO_COLOR }}
            className="transition-[width] duration-300 ease-in-out"
          />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between text-xs">
        <span style={{ color: YES_COLOR }}>{yesPct.toFixed(0)}% YES</span>
        <span style={{ color: NO_COLOR }}>{noPct.toFixed(0)}% NO</span>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-[#2A2A35] bg-[#0D0D0F] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">
            Close
          </p>
          <p className="mt-1 text-xs font-medium text-[#D1D5DB]">
            {formatDateTime(market.closeTime)}
          </p>
        </div>
        <div className="rounded-xl border border-[#2A2A35] bg-[#0D0D0F] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">
            Resolve
          </p>
          <p className="mt-1 text-xs font-medium text-[#D1D5DB]">
            {formatDateTime(market.resolveTime)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-[#A1A1B0]">
          Pool: {formatInit(pool)} INIT
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onBet(market, true)}
            className="rounded-xl border px-3 py-2 text-sm text-white active:scale-[0.97]"
            style={{ background: "#15803D", borderColor: YES_COLOR }}
          >
            YES{" "}
            {yesOdds !== "High" && !isNaN(yesOdds) && Number(yesOdds) !== 2
              ? `(${yesOdds}x)`
              : ""}
          </button>
          <button
            type="button"
            onClick={() => onBet(market, false)}
            className="rounded-xl border px-3 py-2 text-sm text-white active:scale-[0.97]"
            style={{ background: "#991B1B", borderColor: NO_COLOR }}
          >
            NO{" "}
            {noOdds !== "High" && !isNaN(noOdds) && Number(noOdds) !== 2
              ? `(${noOdds}x)`
              : ""}
          </button>
        </div>
      </div>
    </article>
  );
}
