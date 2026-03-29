import { useMemo, useState } from "react";
import { UserDisplay } from "./UserDisplay";

export function AdminView({
  isAdmin,
  allMarkets,
  oracleAddress,
  onCreateMarket,
  onCloseMarket,
  onResolve,
}) {
  const [form, setForm] = useState({
    question: "",
    category: "sports",
    close: "",
    resolve: "",
  });
  const [busy, setBusy] = useState(false);

  const now = Math.floor(Date.now() / 1000);
  const manageable = useMemo(() => allMarkets, [allMarkets]);

  if (!isAdmin) {
    return <p className="text-[#A1A1B0]">Admin access only.</p>;
  }

  const create = async () => {
    if (!form.question || !form.close || !form.resolve) return;
    setBusy(true);
    try {
      const closeTs = Math.floor(new Date(form.close).getTime() / 1000);
      const resolveTs = Math.floor(new Date(form.resolve).getTime() / 1000);
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
    <div className="space-y-6">
      <section className="rounded-2xl bg-[#16161A] p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-[#A1A1B0]">
          <span>Oracle</span>
          <UserDisplay address={oracleAddress} className="text-[#E5E7EB]" />
        </div>
        <h2 className="mb-3 text-base font-semibold text-white">
          Create Market
        </h2>
        <div className="grid gap-3">
          <input
            className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
            placeholder="Question"
            value={form.question}
            onChange={(e) =>
              setForm((f) => ({ ...f, question: e.target.value }))
            }
          />
          <select
            className="rounded-lg bg-[#0D0D0F] px-3 py-2 text-sm text-white"
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
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
            onChange={(e) =>
              setForm((f) => ({ ...f, resolve: e.target.value }))
            }
          />
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="rounded-xl bg-[#7C5CFC] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Creating..." : "Create Market"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-[#16161A] p-4">
        <h2 className="mb-3 text-base font-semibold text-white">
          Manage Markets
        </h2>
        <div className="space-y-2">
          {manageable.map((m) => {
            const canClose = m.status === 0 && now >= m.closeTime;
            const canResolve = m.status === 1 && now >= m.resolveTime;
            return (
              <div key={m.id} className="rounded-lg bg-[#0D0D0F] p-3">
                <p className="mb-2 text-sm text-white">
                  #{m.id} {m.question}
                </p>
                <div className="flex gap-2">
                  {canClose && (
                    <button
                      type="button"
                      onClick={() => onCloseMarket(m.id)}
                      className="rounded-lg bg-[#3F3F46] px-3 py-1.5 text-xs text-white"
                    >
                      Close
                    </button>
                  )}
                  {canResolve && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          onResolve({ marketId: m.id, yesWon: true })
                        }
                        className="rounded-lg bg-[#166534] px-3 py-1.5 text-xs text-white"
                      >
                        Resolve YES
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onResolve({ marketId: m.id, yesWon: false })
                        }
                        className="rounded-lg bg-[#991B1B] px-3 py-1.5 text-xs text-white"
                      >
                        Resolve NO
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
