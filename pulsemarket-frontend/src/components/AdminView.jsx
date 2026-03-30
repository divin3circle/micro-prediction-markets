import { useMemo, useState, useEffect, useCallback } from "react";
import { UserDisplay } from "./UserDisplay";
import { agentApi } from "../lib/agentApi";

const STATUS_LABEL = ["OPEN", "CLOSED", "RESOLVED", "CANCELLED"];
const STATUS_COLOR = {
  OPEN: "text-emerald-400 bg-emerald-400/10",
  CLOSED: "text-amber-400 bg-amber-400/10",
  RESOLVED: "text-violet-400 bg-violet-400/10",
  CANCELLED: "text-zinc-400 bg-zinc-400/10",
};
const VERDICT_COLOR = {
  YES: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  NO: "text-red-400 border-red-500/40 bg-red-500/10",
  UNCERTAIN: "text-amber-400 border-amber-500/40 bg-amber-500/10",
};
const CONFIDENCE_BADGE = {
  HIGH: "bg-emerald-500/20 text-emerald-300",
  MEDIUM: "bg-amber-500/20 text-amber-300",
  LOW: "bg-zinc-500/20 text-zinc-400",
};

function formatInit(micro) {
  return ((micro ?? 0) / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-[#0D0D0F] p-3">
      <p className="text-xs text-[#A1A1B0]">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#A1A1B0]">{sub}</p>}
    </div>
  );
}

function VerdictBadge({ verdict }) {
  if (!verdict) return null;
  const cls = VERDICT_COLOR[verdict.verdict] ?? VERDICT_COLOR.UNCERTAIN;
  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <div className="flex items-center gap-2 font-semibold">
        <span>AI: {verdict.verdict}</span>
        {verdict.confidence && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] ${CONFIDENCE_BADGE[verdict.confidence]}`}>
            {verdict.confidence}
          </span>
        )}
      </div>
      {verdict.reasoning && (
        <p className="mt-1 text-[11px] opacity-80">{verdict.reasoning}</p>
      )}
      {verdict.verificationSource && (
        <p className="mt-1 text-[11px] opacity-60">
          Verify: {verdict.verificationSource}
        </p>
      )}
    </div>
  );
}

export function AdminView({ isAdmin, oracleAddress, onCreateMarket }) {
  const [tab, setTab] = useState("all");
  const [stats, setStats] = useState(null);
  const [verdicts, setVerdicts] = useState({});
  const [agentOnline, setAgentOnline] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [resolving, setResolving] = useState({}); // marketId → "yes"|"no"|null
  const [researching, setResearching] = useState({}); // marketId → bool
  const [error, setError] = useState("");

  // Create-market form (kept here for admin convenience)
  const [form, setForm] = useState({ question: "", category: "sports", close: "", resolve: "" });
  const [busy, setBusy] = useState(false);

  const now = Math.floor(Date.now() / 1000);

  const refresh = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [statsData, verdictsData] = await Promise.all([
        agentApi.getStats(),
        agentApi.getVerdicts(),
      ]);
      setStats(statsData);
      setVerdicts(verdictsData);
      setAgentOnline(true);
    } catch {
      setAgentOnline(false);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const markets = stats?.markets ?? [];

  const filtered = useMemo(() => {
    if (tab === "needs-action") {
      return markets.filter(
        (m) => (m.status === 1 && now >= m.resolveTime) // CLOSED + past resolve time
      );
    }
    if (tab === "resolved") return markets.filter((m) => m.status === 2);
    return markets;
  }, [tab, markets, now]);

  if (!isAdmin) {
    return <p className="text-[#A1A1B0]">Admin access only.</p>;
  }

  const create = async () => {
    if (!form.question || !form.close || !form.resolve) return;
    setBusy(true);
    try {
      const closeTs = Math.floor(new Date(form.close).getTime() / 1000);
      const resolveTs = Math.floor(new Date(form.resolve).getTime() / 1000);
      await onCreateMarket({ question: form.question, category: form.category, closeTime: closeTs, resolveTime: resolveTs });
      setForm({ question: "", category: "sports", close: "", resolve: "" });
    } finally { setBusy(false); }
  };

  const handleResolve = async (marketId, yesWon) => {
    const key = `${marketId}-${yesWon ? "yes" : "no"}`;
    setResolving((r) => ({ ...r, [marketId]: yesWon ? "yes" : "no" }));
    setError("");
    try {
      await agentApi.resolveMarket(marketId, yesWon);
      await refresh();
    } catch (err) {
      setError(`Resolve failed: ${err.message}`);
    } finally {
      setResolving((r) => ({ ...r, [marketId]: null }));
    }
  };

  const handleResearch = async (marketId) => {
    setResearching((r) => ({ ...r, [marketId]: true }));
    try {
      const verdict = await agentApi.researchMarket(marketId);
      setVerdicts((v) => ({ ...v, [marketId]: verdict }));
    } catch (err) {
      setError(`Research failed: ${err.message}`);
    } finally {
      setResearching((r) => ({ ...r, [marketId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Agent status banner */}
      <div
        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs ${
          agentOnline === null ? "bg-[#1e1e24] text-[#A1A1B0]" :
          agentOnline ? "bg-emerald-500/10 text-emerald-400" :
          "bg-red-500/10 text-red-400"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            agentOnline === null ? "bg-zinc-500" : agentOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
          }`}
        />
        {agentOnline === null
          ? "Checking agent…"
          : agentOnline
            ? "Agent online — auto-close and AI research running"
            : "Agent offline — start pulsemarket-agent to enable auto-close and AI research"}
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Markets" value={stats.total} />
          <StatCard label="Open" value={stats.open} />
          <StatCard label="Closed" value={stats.closed} />
          <StatCard label="Resolved" value={stats.resolved} />
          <StatCard
            label="Total Volume"
            value={`${formatInit(stats.totalVolume)}`}
            sub="INIT"
          />
          <StatCard
            label="AI Verdicts"
            value={Object.keys(verdicts).length}
          />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Create Market */}
      <section className="rounded-2xl bg-[#16161A] p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-[#A1A1B0]">
          <span>Oracle</span>
          <UserDisplay address={oracleAddress} className="text-[#E5E7EB]" />
        </div>
        <h2 className="mb-3 text-base font-semibold text-white">Create Market</h2>
        <div className="grid gap-3">
          <input
            className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
            placeholder="Question"
            value={form.question}
            onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
          />
          <select
            className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="sports">sports</option>
            <option value="crypto">crypto</option>
            <option value="news">news</option>
          </select>
          <input
            type="datetime-local"
            className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
            value={form.close}
            onChange={(e) => setForm((f) => ({ ...f, close: e.target.value }))}
          />
          <input
            type="datetime-local"
            className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
            value={form.resolve}
            onChange={(e) => setForm((f) => ({ ...f, resolve: e.target.value }))}
          />
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="rounded-xl bg-[#7C5CFC] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create Market"}
          </button>
        </div>
      </section>

      {/* Market management */}
      <section className="rounded-2xl bg-[#16161A] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Markets</h2>
          <button
            onClick={refresh}
            className="rounded-lg bg-[#0D0D0F] px-3 py-1.5 text-xs text-[#A1A1B0] hover:text-white"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          {[
            { key: "all", label: "All" },
            { key: "needs-action", label: "Needs Action" },
            { key: "resolved", label: "Resolved" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                tab === key ? "bg-[#7C5CFC] text-white" : "bg-[#0D0D0F] text-[#A1A1B0] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loadingStats ? (
          <p className="text-sm text-[#A1A1B0]">Loading markets…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#A1A1B0]">No markets in this view.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => {
              const statusLabel = STATUS_LABEL[m.status] ?? "UNKNOWN";
              const statusCls = STATUS_COLOR[statusLabel] ?? "";
              const canResolve = m.status === 1 && now >= m.resolveTime;
              const verdict = verdicts[m.id];
              const isResolvingYes = resolving[m.id] === "yes";
              const isResolvingNo = resolving[m.id] === "no";
              const isResearching = researching[m.id];

              return (
                <div key={m.id} className="rounded-xl bg-[#0D0D0F] p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] text-[#A1A1B0]">#{m.id} · {m.category}</p>
                      <p className="text-sm text-white">{m.question}</p>
                      <p className="mt-1 text-[10px] text-[#6B7280]">
                        Vol: {formatInit(m.totalYesAmount + m.totalNoAmount)} INIT ·
                        Close: {new Date(m.closeTime * 1000).toLocaleDateString()} ·
                        Resolve: {new Date(m.resolveTime * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${statusCls}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* AI verdict */}
                  <VerdictBadge verdict={verdict} />

                  {/* Action buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {/* Research button for CLOSED markets */}
                    {m.status === 1 && (
                      <button
                        type="button"
                        onClick={() => handleResearch(m.id)}
                        disabled={isResearching}
                        className="rounded-lg bg-[#1e1e24] px-3 py-1.5 text-xs text-[#A1A1B0] hover:text-white disabled:opacity-50"
                      >
                        {isResearching ? "Researching…" : verdict ? "🔄 Re-research" : "🔍 Research AI"}
                      </button>
                    )}

                    {/* Resolve buttons (backend oracle) */}
                    {canResolve && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleResolve(m.id, true)}
                          disabled={isResolvingYes || isResolvingNo}
                          className="rounded-lg bg-[#166534] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                        >
                          {isResolvingYes ? "Resolving…" : "✅ Resolve YES"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(m.id, false)}
                          disabled={isResolvingYes || isResolvingNo}
                          className="rounded-lg bg-[#991B1B] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                        >
                          {isResolvingNo ? "Resolving…" : "❌ Resolve NO"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
