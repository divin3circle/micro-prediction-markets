import { useState, useCallback } from "react";
import { agentApi } from "../lib/agentApi";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
  DrawerClose,
} from "./ui/drawer";

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

function parseDateTimeToSec(dateTimeLocal) {
  return Math.floor(new Date(dateTimeLocal).getTime() / 1000);
}

export default function CreateMarketView({
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  // AI gate
  const [gateState, setGateState] = useState(GATE_IDLE); // idle | checking | ok | warn | fail
  const [gateReason, setGateReason] = useState("");

  function resetGateIfNeeded() {
    if (gateState !== GATE_IDLE) {
      setGateState(GATE_IDLE);
      setGateReason("");
    }
  }

  /** Reset AI gate whenever question/timing changes */
  const handleQuestionChange = (e) => {
    setForm((f) => ({ ...f, question: e.target.value }));
    resetGateIfNeeded();
  };

  const handleCloseChange = (e) => {
    setForm((f) => ({ ...f, close: e.target.value }));
    resetGateIfNeeded();
  };

  const handleResolveChange = (e) => {
    setForm((f) => ({ ...f, resolve: e.target.value }));
    resetGateIfNeeded();
  };

  const checkWithAI = useCallback(async () => {
    if (!form.question.trim()) {
      setError("Enter a question before checking with AI.");
      return;
    }
    if (!form.close) {
      setError("Select a close time before checking with AI.");
      return;
    }
    if (!form.resolve) {
      setError("Select a resolve time before checking with AI.");
      return;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const closeTs = parseDateTimeToSec(form.close);
    const resolveTs = parseDateTimeToSec(form.resolve);

    if (closeTs <= nowSec + 30) {
      setError("Close time must be at least 30 seconds in the future.");
      return;
    }
    if (resolveTs < closeTs) {
      setError("Resolve time must be on or after close time.");
      return;
    }

    setError("");
    setGateState(GATE_CHECKING);
    setGateReason("");
    setDrawerOpen(true);
    try {
      const result = await agentApi.validateQuestion(
        form.question.trim(),
        closeTs,
        resolveTs,
      );
      if (result.ok === true) {
        setGateState(GATE_OK);
        setGateReason(result.reason ?? "Question looks good!");
      } else if (result.ok === false) {
        setGateState(GATE_FAIL);
        setGateReason(result.reason ?? "AI considers this question unsuitable.");
      } else {
        setGateState(GATE_FAIL);
        setGateReason("AI check returned an unknown result. Please retry.");
      }
    } catch (err) {
      setGateState(GATE_FAIL);
      setGateReason(err?.message || "Could not reach the AI agent. Validation is required before create.");
    }
  }, [form.question, form.close, form.resolve]);

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
    const closeTs = parseDateTimeToSec(form.close);
    const resolveTs = parseDateTimeToSec(form.resolve);

    if (closeTs <= nowSec + 30) {
      setError("Close time must be at least 30 seconds in the future.");
      return;
    }
    if (resolveTs < closeTs) {
      setError("Resolve time must be on or after close time.");
      return;
    }

    if (gateState !== GATE_OK) {
      setError("Run AI Check and get approval before creating this market.");
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
        {/* Question input */}
        <div>
          <input
            className="w-full rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
            placeholder="Question (for example: Will BTC close above 120k this week?)"
            value={form.question}
            onChange={handleQuestionChange}
          />
        </div>

        {/* Category selector */}
        <select
          className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        >
          <option value="sports">sports</option>
          <option value="crypto">crypto</option>
          <option value="news">news</option>
        </select>

        {/* Close time */}
        <label className="text-xs text-[#9CA3AF]">Close time (must be in the future)</label>
        <input
          type="datetime-local"
          min={minDateTime}
          className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
          value={form.close}
          onChange={handleCloseChange}
        />

        {/* Resolve time */}
        <label className="text-xs text-[#9CA3AF]">Resolve time (on or after close time)</label>
        <input
          type="datetime-local"
          min={form.close || minDateTime}
          className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
          value={form.resolve}
          onChange={handleResolveChange}
        />

        <p className="text-xs text-[#6B7280]">
          AI will validate your question against the close and resolve times.
          Markets that are likely unresolvable by resolve time will be blocked.
        </p>

        {/* Validate button (opens drawer) */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <button
              type="button"
              onClick={checkWithAI}
              disabled={!form.question.trim() || !form.close || !form.resolve || gateState === GATE_CHECKING}
              className="mt-2 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {gateState === GATE_CHECKING ? "Validating..." : "Validate"}
            </button>
          </DrawerTrigger>

          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Market Validation</DrawerTitle>
              <DrawerDescription>
                AI is analyzing your market question
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody>
              {gateState === GATE_CHECKING && (
                <div className="flex flex-col items-center justify-center gap-3 py-6">
                  <div className="animate-spin text-3xl">⏳</div>
                  <p className="text-sm text-[#A1A1B0]">Checking with AI…</p>
                </div>
              )}

              {gateState === GATE_OK && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm text-emerald-300">
                      <span className="text-lg">✅</span>
                      <span className="font-semibold">Validation Passed</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#0D0D0F] px-4 py-3">
                    <p className="text-sm text-[#A1A1B0]">{gateReason}</p>
                  </div>
                  <div className="rounded-lg border border-[#2A2A35] bg-[#16161A] px-4 py-3">
                    <p className="text-xs text-[#6B7280] mb-2 font-semibold">Market Details:</p>
                    <div className="space-y-2 text-xs text-[#A1A1B0]">
                      <p>
                        <span className="text-[#6B7280]">Question:</span> {form.question}
                      </p>
                      <p>
                        <span className="text-[#6B7280]">Category:</span> {form.category}
                      </p>
                      <p>
                        <span className="text-[#6B7280]">Close:</span>{" "}
                        {new Date(parseDateTimeToSec(form.close) * 1000).toLocaleString()}
                      </p>
                      <p>
                        <span className="text-[#6B7280]">Resolve:</span>{" "}
                        {new Date(parseDateTimeToSec(form.resolve) * 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {gateState === GATE_FAIL && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm text-red-400">
                      <span className="text-lg">❌</span>
                      <span className="font-semibold">Validation Failed</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#0D0D0F] px-4 py-3">
                    <p className="text-sm text-red-300">{gateReason}</p>
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    Please review your question and timing, then try again.
                  </p>
                </div>
              )}
            </DrawerBody>

            <DrawerFooter>
              {gateState === GATE_OK && (
                <>
                  <DrawerClose asChild>
                    <button
                      type="button"
                      className="rounded-lg border border-[#2A2A35] bg-[#1e1e24] px-4 py-2 text-sm text-[#A1A1B0] hover:text-white"
                    >
                      Back
                    </button>
                  </DrawerClose>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                    }}
                    className="rounded-lg bg-[#7C5CFC] px-4 py-2 text-sm text-white hover:bg-[#6B4CDC]"
                  >
                    Continue to Create
                  </button>
                </>
              )}
              {gateState === GATE_FAIL && (
                <DrawerClose asChild>
                  <button
                    type="button"
                    className="rounded-lg bg-[#1e1e24] px-4 py-2 text-sm text-[#A1A1B0] hover:text-white"
                  >
                    Close
                  </button>
                </DrawerClose>
              )}
              {gateState === GATE_CHECKING && (
                <button
                  type="button"
                  disabled
                  className="rounded-lg bg-[#1e1e24] px-4 py-2 text-sm text-[#A1A1B0] opacity-50"
                >
                  Please wait…
                </button>
              )}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Create button - only visible after validation passes */}
        {gateState === GATE_OK && (
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="mt-2 rounded-xl bg-[#7C5CFC] px-4 py-2 text-sm text-white disabled:opacity-50 hover:bg-[#6B4CDC]"
          >
            {busy
              ? "Submitting..."
              : initiaAddress
                ? `Create Market (${formatInit(creationFee)} INIT fee)`
                : "Connect Wallet to Create"}
          </button>
        )}
      </div>
    </section>
  );
}
