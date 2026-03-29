import { useState } from "react";

function formatInit(micro) {
  return (micro / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

  const create = async () => {
    if (!initiaAddress) {
      onConnect?.();
      return;
    }
    if (!form.question || !form.close || !form.resolve) return;

    const closeTs = Math.floor(new Date(form.close).getTime() / 1000);
    const resolveTs = Math.floor(new Date(form.resolve).getTime() / 1000);
    if (resolveTs < closeTs) return;

    setBusy(true);
    try {
      await onCreateMarket({
        question: form.question,
        category: form.category,
        closeTime: closeTs,
        resolveTime: resolveTs,
      });
      setForm({ question: "", category: "sports", close: "", resolve: "" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[720px] rounded-2xl bg-[#16161A] p-5 shadow-xl">
      <h2 className="mb-2 text-lg font-semibold text-white">Create a Market</h2>
      <p className="mb-4 text-sm text-[#A1A1B0]">
        Anyone can create a market. A listing fee of {formatInit(creationFee)}{" "}
        INIT is charged and sent to the platform wallet.
      </p>

      <div className="grid gap-3">
        <input
          className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
          placeholder="Question (for example: Will BTC close above 120k this week?)"
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
        <label className="text-xs text-[#9CA3AF]">Close time</label>
        <input
          type="datetime-local"
          className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
          value={form.close}
          onChange={(e) => setForm((f) => ({ ...f, close: e.target.value }))}
        />
        <label className="text-xs text-[#9CA3AF]">Resolve time</label>
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
