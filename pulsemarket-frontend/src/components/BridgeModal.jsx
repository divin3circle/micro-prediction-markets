import { InterwovenKit } from "@initia/interwovenkit-react";

export function BridgeModal({
  open,
  onClose,
  bridgeDefaults,
  sourceChainLabel,
  destinationChainLabel,
}) {
  if (!open) return null;

  return (
    <div className="fixed mx-2 inset-0 z-50 bg-black/70 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="Close bridge"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-auto rounded-t-3xl border border-[#2A2A35] bg-[#0E0E14] p-4 md:inset-auto md:left-1/2 md:top-1/2 md:w-[760px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B8FA6]">
              PulseMarket
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-white">Swap</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2A2A35] bg-[#171722] px-3 py-1.5 text-sm text-[#A1A1B0] hover:text-white"
          >
            Close
          </button>
        </div>

        <div
          className="bridge-shell rounded-3xl border border-[#2A2A35] bg-[linear-gradient(180deg,#1A1B27_0%,#11121A_100%)] p-3"
          style={{
            "--bg": "#161824",
            "--gray-9": "#161824",
            "--gray-8": "#1E2130",
            "--gray-7": "#262A3B",
            "--gray-6": "#32384E",
            "--gray-5": "#3E4560",
            "--gray-4": "#8D94B5",
            "--gray-3": "#A9B0CB",
            "--gray-2": "#C2C8DF",
            "--gray-1": "#E6E8F2",
            "--gray-0": "#FFFFFF",
            "--border": "#31364B",
            "--border-radius": "20px",
            "--font-family": "'Space Grotesk', sans-serif",
            "--button-bg": "#7C5CFC",
            "--button-bg-hover": "#8E73FF",
            "--button-text": "#FFFFFF",
            "--bridge-meta-bg": "#1B1F2F",
            "--bridge-meta-button-bg": "#2A2F42",
          }}
        >
          <div className="mb-3 rounded-2xl border border-[#31364B] bg-[#151928] px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#C2C8DF]">
              <span className="rounded-full border border-[#3A4060] bg-[#222741] px-2 py-1">
                From: {sourceChainLabel}
              </span>
              <span className="text-[#7E86A8]">→</span>
              <span className="rounded-full border border-[#3A4060] bg-[#222741] px-2 py-1">
                To: {destinationChainLabel}
              </span>
            </div>
          </div>
          <InterwovenKit bridge={bridgeDefaults} />
        </div>
      </div>
    </div>
  );
}
