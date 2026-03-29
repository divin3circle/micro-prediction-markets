import { InterwovenKit } from "@initia/interwovenkit-react";

export function BridgeModal({ open, onClose, bridgeDefaults }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="Close bridge"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-auto rounded-t-3xl border border-[#2A2A35] bg-[#1C1C23] p-3 md:inset-auto md:left-1/2 md:top-1/2 md:w-[620px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:p-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-white">
            Deposit to micro-markets
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-[#A1A1B0] hover:bg-[#2A2A35]"
          >
            Close
          </button>
        </div>
        <InterwovenKit bridge={bridgeDefaults} />
      </div>
    </div>
  );
}
