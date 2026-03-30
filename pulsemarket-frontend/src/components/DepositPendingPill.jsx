import { CHAIN_ID } from "../config/chain";

export function DepositPendingPill({ depositPending }) {
  if (!depositPending) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full border border-[#2A2A35] bg-[#171722] px-4 py-2 text-xs text-[#CBD5E1]">
      Waiting for deposit confirmation on {CHAIN_ID}...
    </div>
  );
}
