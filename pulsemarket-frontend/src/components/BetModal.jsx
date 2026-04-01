import { useMemo, useState } from "react";
import { useInitiaUsername } from "../hooks/useInitiaUsername";

function toMicro(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num * 1_000_000);
}

function fromMicro(value) {
  return (value / 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

export function BetModal({
  open,
  market,
  initialSide,
  onClose,
  onPlace,
  connectedAddress,
}) {
  const [side, setSide] = useState(initialSide ? "YES" : "NO");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Placing bet...");
  const { username, loading: usernameLoading } =
    useInitiaUsername(connectedAddress);

  const betMicro = toMicro(amount);
  const totalPool =
    (market?.totalYesAmount ?? 0) + (market?.totalNoAmount ?? 0);
  const feeBps = 200;

  const preview = useMemo(() => {
    if (!market || !betMicro) return { payout: 0, share: 0 };
    const sideTotal =
      side === "YES" ? market.totalYesAmount : market.totalNoAmount;
    const fee = Math.floor(((totalPool + betMicro) * feeBps) / 10000);
    const net = totalPool + betMicro - fee;
    const payout = Math.floor((net * betMicro) / (sideTotal + betMicro));
    const share = ((betMicro / (sideTotal + betMicro)) * 100).toFixed(1);
    return { payout, share };
  }, [betMicro, feeBps, market, side, totalPool]);

  const showOneSidedWarning =
    !!market &&
    ((side === "YES" && (market.totalNoAmount ?? 0) === 0) ||
      (side === "NO" && (market.totalYesAmount ?? 0) === 0));

  if (!open || !market) return null;

  const place = async () => {
    if (!betMicro || busy) return;
    try {
      setBusy(true);
      setBusyLabel("Enabling auto-sign...");
      await onPlace({
        marketId: market.id,
        betYes: side === "YES",
        amount: betMicro,
        onAutoSignStart: () => setBusyLabel("Enabling auto-sign..."),
        onTxStart: () => setBusyLabel("Placing bet..."),
      });
      onClose();
      setAmount("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60">
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-[#2A2A35] bg-[#1C1C23] p-6 md:inset-auto md:left-1/2 md:top-1/2 md:w-[560px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="mb-2 text-sm text-[#A1A1B0]">{market.category}</p>
            <h3 className="text-lg font-semibold text-white">
              {market.question}
            </h3>
          </div>
          <button onClick={onClose} className="text-[#A1A1B0]" type="button">
            Close
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-xl border border-[#2A2A35] p-1">
          <button
            type="button"
            onClick={() => setSide("YES")}
            className={`rounded-lg px-3 py-3 text-sm transition ${
              side === "YES" ? "bg-[#22C55E] text-white" : "text-[#22C55E]"
            }`}
          >
            YES
          </button>
          <button
            type="button"
            onClick={() => setSide("NO")}
            className={`rounded-lg px-3 py-3 text-sm transition ${
              side === "NO" ? "bg-[#EF4444] text-white" : "text-[#EF4444]"
            }`}
          >
            NO
          </button>
        </div>

        <div className="mb-3 rounded-xl border border-[#2A2A35] bg-[#0D0D0F] px-4 py-3">
          <div className="flex items-center justify-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent text-center text-3xl font-semibold text-white outline-none"
            />
            <span className="text-sm text-[#A1A1B0]">INIT</span>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          {[10, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmount(String(n))}
              className="rounded-full border border-[#2A2A35] px-3 py-1.5 text-xs text-[#D1D5DB]"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAmount("1000")}
            className="rounded-full border border-[#2A2A35] px-3 py-1.5 text-xs text-[#D1D5DB]"
          >
            Max
          </button>
        </div>

        <div className="mb-5 rounded-xl bg-[#0D0D0F] p-4 text-sm">
          <div className="mb-2 flex justify-between text-[#A1A1B0]">
            <span>Potential payout</span>
            <span className="text-white">{fromMicro(preview.payout)} INIT</span>
          </div>
          <div className="mb-2 flex justify-between text-[#A1A1B0]">
            <span>Your pool share</span>
            <span className="text-white">{preview.share}%</span>
          </div>
          <div className="flex justify-between text-[#A1A1B0]">
            <span>Platform fee</span>
            <span className="text-white">2%</span>
          </div>
        </div>

        {showOneSidedWarning && (
          <p className="mb-4 text-[12px] text-[#854F0B]">
            {`Warning: You're the only side - if nobody bets ${
              side === "YES" ? "NO" : "YES"
            }, you'll receive a full refund if ${side} wins.`}
          </p>
        )}

        {connectedAddress && !username && !usernameLoading && (
          <p className="mb-4 text-xs text-[#A1A1B0]">
            {"Get a .init username to personalise your profile -> "}
            <a
              href="https://app.testnet.initia.xyz/usernames"
              target="_blank"
              rel="noreferrer"
              className="text-[#7C5CFC] underline-offset-2 hover:underline"
            >
              Register now
            </a>
          </p>
        )}

        <button
          type="button"
          onClick={place}
          disabled={busy || !betMicro}
          className="h-12 w-full rounded-xl bg-[#7C5CFC] text-white transition active:scale-[0.97] disabled:opacity-50"
        >
          {busy ? busyLabel : "Place Bet"}
        </button>
      </div>
    </div>
  );
}
