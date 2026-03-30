const AGENT_BASE = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";
const ADMIN_SECRET = import.meta.env.VITE_AGENT_SECRET || "";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${AGENT_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": ADMIN_SECRET,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const agentApi = {
  /** Fetch all markets + stats from the backend agent */
  getStats: () => apiFetch("/api/stats"),

  /** Fetch all markets */
  getMarkets: () => apiFetch("/api/markets"),

  /** Fetch all AI verdicts */
  getVerdicts: () => apiFetch("/api/verdicts"),

  /** Fetch verdict for a single market */
  getVerdict: (id) => apiFetch(`/api/verdicts/${id}`),

  /** Manually trigger AI research for a market */
  researchMarket: (id) => apiFetch(`/api/research/${id}`, { method: "POST" }),

  /** Oracle resolves a market via the backend */
  resolveMarket: (id, yesWon) =>
    apiFetch(`/api/resolve/${id}`, {
      method: "POST",
      body: JSON.stringify({ yesWon }),
    }),

  /** Validate a market question with AI */
  validateQuestion: (question) =>
    apiFetch("/api/validate-question", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),

  /** Health check */
  health: () => apiFetch("/health").catch(() => null),
};
