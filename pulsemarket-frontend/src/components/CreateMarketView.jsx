import { useState, useCallback } from "react";
import { agentApi } from "../lib/agentApi";

function formatInit(micro) {
  return (micro / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Returns the current datetime + 1 min formatted for datetime-local min attr */
function nowLocalMin() {
  const d = new Date(Date.now() + 60_000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

const GATE_IDLE = "idle";
const GATE_CHECKING = "checking";
const GATE_OK = "ok";
const GATE_WARN = "warn";
const GATE_FAIL = "fail";

function AIGateBadge({ state, reason }) {
  if (state === GATE_IDLE) return null;
  if (state === GATE_CHECKING) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#2A2A35] bg-[#0D0D0F] px-4 py-3 text-sm text-[#A1A1B0]">
        <span className="animate-spin text-base">⏳</span>
        Checking with AI…
      </div>
    );
  }
  const cfg = {
    [GATE_OK]:   { icon: "✅", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
    [GATE_WARN]: { icon: "⚠️", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
    [GATE_FAIL]: { icon: "❌", cls: "border-red-500/40 bg-red-500/10 text-red-400" },
  }[state] ?? { icon: "ℹ️", cls: "border-[#2A2A35] bg-[#0D0D0F] text-[#A1A1B0]" };

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${cfg.cls}`}>
      <span className="mr-2">{cfg.icon}</span>
      {reason}
    </div>
  );
}

export function CreateMarketView({
  initiaAddress,
  creationFee,
  onConnect,
  onCreateMarket,
}) {
  const [form, setForm] = useState({
    question: "",
    category: "sports",
    close: "",
    resolve: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // AI gate
  const [gateState, setGateState] = useState(GATE_IDLE); // idle | checking | ok | warn | fail
  const [gateReason, setGateReason] = useState("");

  /** Reset gate when question changes */
  const handleQuestionChange = (e) => {
    setForm((f) => ({ ...f, question: e.target.value }));
    if (gateState !== GATE_IDLE) {
      setGateState(GATE_IDLE);
      setGateReason("");
    }
  };

  const checkWithAI = useCallback(async () => {
    if (!form.question.trim()) {
      setError("Enter a question before checking with AI.");
      return;
    }
    setGateState(GATE_CHECKING);
    setGateReason("");
    try {
      const result = await agentApi.validateQuestion(form.question.trim());
      if (result.ok === true) {
        setGateState(GATE_OK);
        setGateReason(result.reason ?? "Question looks good!");
      } else if (result.ok === false) {
        setGateState(GATE_FAIL);
        setGateReason(result.reason ?? "AI considers this question unsuitable.");
      } else {
        // Agent offline or unknown response
        setGateState(GATE_WARN);
        setGateReason("Agent offline — AI check skipped. You can still submit.");
      }
    } catch {
      setGateState(GATE_WARN);
      setGateReason("Could not reach the AI agent — check skipped. You can still submit.");
    }
  }, [form.question]);

  const create = async () => {
    if (!initiaAddress) {
      onConnect?.();
      return;
    }
    setError("");

    if (!form.question.trim()) { setError("Question is required."); return; }
    if (!form.close)           { setError("Close time is required."); return; }
    if (!form.resolve)         { setError("Resolve time is required."); return; }

    const nowSec    = Math.floor(Date.now() / 1000);
    const closeTs   = Math.floor(new Date(form.close).getTime() / 1000);
    const resolveTs = Math.floor(new Date(form.resolve).getTime() / 1000);

    if (closeTs <= nowSec + 30) {
      setError("Close time must be at least 30 seconds in the future.");
      return;
    }
    if (resolveTs < closeTs) {
      setError("Resolve time must be on or after close time.");
      return;
    }

    // Soft-block if AI explicitly rejected the question
    if (gateState === GATE_FAIL) {
      setError("AI flagged this question as unsuitable. Please revise or run the check again.");
      return;
    }

    setBusy(true);
    try {
      await onCreateMarket({
        question: form.question,
        category: form.category,
        closeTime: closeTs,
        resolveTime: resolveTs,
      });
      setForm({ question: "", category: "sports", close: "", resolve: "" });
      setGateState(GATE_IDLE);
      setGateReason("");
    } catch (err) {
      const msg = err?.message ?? String(err);
      if (msg.includes("0xb") || msg.includes("E_CLOSE_TIME_PAST")) {
        setError(
          "The chain rejected the close time — it must be in the future. Please pick a later time."
        );
      } else {
        setError(`Transaction failed: ${msg}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const minDateTime = nowLocalMin();

  return (
    <section className="mx-auto w-full max-w-[720px] rounded-2xl bg-[#16161A] p-5 shadow-xl">
      <h2 className="mb-2 text-lg font-semibold text-white">Create a Market</h2>
      <p className="mb-4 text-sm text-[#A1A1B0]">
        Anyone can create a market. A listing fee of {formatInit(creationFee)}{" "}
        INIT is charged and sent to the platform wallet.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {/* Question + AI gate */}
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
            placeholder="Question (for example: Will BTC close above 120k this week?)"
            value={form.question}
            onChange={handleQuestionChange}
          />
          <button
            type="button"
            onClick={checkWithAI}
            disabled={gateState === GATE_CHECKING}
            title="Validate question with AI"
            className="shrink-0 rounded-lg bg-[#1e1e24] px-3 py-2 text-xs text-[#A1A1B0] hover:text-white disabled:opacity-50"
          >
            {gateState === GATE_CHECKING ? "…" : "🤖 AI Check"}
          </button>
        </div>

        <AIGateBadge state={gateState} reason={gateReason} />

        <select
          className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        >
          <option value="sports">sports</option>
          <option value="crypto">crypto</option>
          <option value="news">news</option>
        </select>
        <label className="text-xs text-[#9CA3AF]">Close time (must be in the future)</label>
        <input
          type="datetime-local"
          min={minDateTime}
          className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
          value={form.close}
          onChange={(e) => setForm((f) => ({ ...f, close: e.target.value }))}
        />
        <label className="text-xs text-[#9CA3AF]">Resolve time (on or after close time)</label>
        <input
          type="datetime-local"
          min={form.close || minDateTime}
          className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
          value={form.resolve}
          onChange={(e) => setForm((f) => ({ ...f, resolve: e.target.value }))}
        />
        <button
          type="button"
          onClick={create}
          disabled={busy || gateState === GATE_CHECKING}
          className="mt-2 rounded-xl bg-[#7C5CFC] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy
            ? "Submitting..."
            : initiaAddress
              ? `Create Market (${formatInit(creationFee)} INIT fee)`
              : "Connect Wallet to Create"}
        </button>
      </div>
    </section>
  );
}
