import { useCallback, useEffect, useMemo, useState } from "react";
import { agentApi } from "../lib/agentApi";

// ─── colour helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL = ["OPEN", "CLOSED", "RESOLVED", "CANCELLED"];
const STATUS_COLOR = {
  OPEN: "text-emerald-400 bg-emerald-400/10",
  CLOSED: "text-amber-400  bg-amber-400/10",
  RESOLVED: "text-violet-400 bg-violet-400/10",
  CANCELLED: "text-zinc-400   bg-zinc-400/10",
};
const VERDICT_COLOR = {
  YES: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  NO: "text-red-400     border-red-500/40     bg-red-500/10",
  UNCERTAIN: "text-amber-400   border-amber-500/40   bg-amber-500/10",
};
const CONFIDENCE_BADGE = {
  HIGH: "bg-emerald-500/20 text-emerald-300",
  MEDIUM: "bg-amber-500/20   text-amber-300",
  LOW: "bg-zinc-500/20    text-zinc-400",
};

function fmt(micro) {
  return ((micro ?? 0) / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDateTime(sec) {
  return new Date(sec * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── small pieces ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-[#0D0D0F] p-4">
      <p className="text-xs text-[#A1A1B0]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value ?? "—"}</p>
      {sub && <p className="mt-0.5 text-xs text-[#A1A1B0]">{sub}</p>}
    </div>
  );
}

function AgentBanner({ online }) {
  const cls =
    online === null
      ? "bg-[#1e1e24] text-[#A1A1B0]"
      : online
        ? "bg-emerald-500/10 text-emerald-400"
        : "bg-red-500/10 text-red-400";
  const dot =
    online === null
      ? "bg-zinc-500"
      : online
        ? "bg-emerald-500 animate-pulse"
        : "bg-red-500";
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs ${cls}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {online === null
        ? "Checking AI agent…"
        : online
          ? "AI agent online — auto-resolution running every 5 min"
          : "AI agent offline — start pulsemarket-agent to enable auto-resolution"}
    </div>
  );
}

function VerdictCard({ market, verdict }) {
  const statusLabel = STATUS_LABEL[market.status] ?? "UNKNOWN";
  const verdictKey = verdict?.verdict ?? "UNCERTAIN";
  return (
    <div className="rounded-2xl border border-white/5 bg-[#111113] p-4 space-y-3">
      {/* header row */}
      <div className="flex items-start justify-between gap-3">
        <p className="flex-1 text-sm font-medium text-white leading-snug">
          {market.question}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            STATUS_COLOR[statusLabel] ?? "text-zinc-400 bg-zinc-400/10"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* category + market id */}
      <div className="flex items-center gap-3 text-[11px] text-[#A1A1B0]">
        {market.category && (
          <span className="rounded bg-[#1e1e24] px-2 py-0.5 uppercase tracking-wide">
            {market.category}
          </span>
        )}
        <span>Market #{market.id}</span>
        {market.totalVolume > 0 && (
          <span>Vol {fmt(market.totalVolume)} INIT</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-[#0D0D0F] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Close time</p>
          <p className="mt-1 text-xs text-[#D1D5DB]">{fmtDateTime(market.closeTime)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#0D0D0F] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Resolve time</p>
          <p className="mt-1 text-xs text-[#D1D5DB]">{fmtDateTime(market.resolveTime)}</p>
        </div>
      </div>

      {/* AI verdict */}
      {verdict ? (
        <div
          className={`rounded-lg border px-3 py-2.5 text-xs ${
            VERDICT_COLOR[verdictKey] ?? VERDICT_COLOR.UNCERTAIN
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            <span>🤖 AI verdict: {verdict.verdict}</span>
            {verdict.confidence && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  CONFIDENCE_BADGE[verdict.confidence] ?? ""
                }`}
              >
                {verdict.confidence}
              </span>
            )}
            {verdict.resolvedAt && (
              <span className="ml-auto text-[10px] opacity-60">
                {new Date(verdict.resolvedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          {verdict.reasoning && (
            <p className="mt-1.5 text-[11px] opacity-80 leading-relaxed">
              {verdict.reasoning}
            </p>
          )}
          {verdict.verificationSource && (
            <p className="mt-1 text-[11px] opacity-50">
              Source: {verdict.verificationSource}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-[#555560] italic">
          No AI verdict yet — agent will research after market closes.
        </p>
      )}
    </div>
  );
}

// ─── main view ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "all", label: "All markets" },
  { key: "verdicts", label: "AI verdicts" },
  { key: "resolved", label: "Resolved" },
];

export function StatsView() {
  const [stats, setStats] = useState(null);
  const [verdicts, setVerdicts] = useState({});
  const [agentOnline, setAgentOnline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, v] = await Promise.all([
        agentApi.getStats(),
        agentApi.getVerdicts(),
      ]);
      setStats(s);
      setVerdicts(v ?? {});
      setAgentOnline(true);
    } catch {
      setAgentOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const markets = stats?.markets ?? [];

  const displayed = useMemo(() => {
    if (tab === "verdicts")
      return markets.filter((m) => Boolean(verdicts[m.id]));
    if (tab === "resolved") return markets.filter((m) => m.status === 2);
    return markets;
  }, [tab, markets, verdicts]);

  return (
    <div className="space-y-6">
      {/* Agent banner */}
      <AgentBanner online={agentOnline} />

      {/* Stat cards */}
      {loading && !stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-[#0D0D0F]"
            />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total markets" value={stats.total} />
          <StatCard label="Open" value={stats.open} />
          <StatCard label="Closed" value={stats.closed} />
          <StatCard label="Resolved" value={stats.resolved} />
          <StatCard
            label="Total volume"
            value={fmt(stats.totalVolume)}
            sub="INIT"
          />
          <StatCard label="AI verdicts" value={Object.keys(verdicts).length} />
        </div>
      ) : (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Could not reach the AI agent backend. Is{" "}
          <code>pulsemarket-agent</code> running on port 3001?
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-[#0D0D0F] p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-[#7C5CFC] text-white"
                : "text-[#A1A1B0] hover:text-white"
            }`}
          >
            {t.label}
            {t.key === "verdicts" && Object.keys(verdicts).length > 0 && (
              <span className="ml-1.5 rounded-full bg-white/10 px-1.5 text-[11px]">
                {Object.keys(verdicts).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Market + verdict list */}
      {displayed.length === 0 ? (
        <p className="text-center text-sm text-[#A1A1B0] py-8">
          {tab === "verdicts"
            ? "No AI verdicts yet — they appear after markets close."
            : "No markets yet."}
        </p>
      ) : (
        <div className="space-y-3 gap-3 flex flex-col-reverse">
          {displayed.map((m) => (
            <VerdictCard
              key={m.id}
              market={m}
              verdict={verdicts[m.id] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
