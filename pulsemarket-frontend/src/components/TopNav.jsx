import { useInterwovenKit } from "@initia/interwovenkit-react";
import { UserDisplay } from "./UserDisplay";
import { Header } from "./ui/header-3";
import icon2 from "../../assets/icon2.jpeg";
import icon from "../../assets/icon1.png";

export function TopNav({
  autoSignActive,
  onEnableAutoSign,
  autoSignLoading,
  onOpenDeposit,
  balanceMicro,
  balanceLoading,
  l1BalanceMicro,
  l1BalanceLoading,
}) {
  const { initiaAddress, openConnect, openWallet } = useInterwovenKit();
  const balanceText =
    typeof balanceMicro === "number"
      ? `${(balanceMicro / 1_000_000).toLocaleString(undefined, {
          maximumFractionDigits: 3,
        })} INIT`
      : "0 INIT";
  const l1BalanceText =
    typeof l1BalanceMicro === "number"
      ? `${(l1BalanceMicro / 1_000_000).toLocaleString(undefined, {
          maximumFractionDigits: 3,
        })} INIT`
      : "0 INIT";

  const walletNode = !initiaAddress ? (
    <button
      onClick={openConnect}
      className="rounded-xl bg-[#7C5CFC] px-3 py-2 text-sm font-medium text-white shadow-[0_8px_24px_rgba(124,92,252,0.35)] active:scale-[0.97]"
      type="button"
    >
      Connect
    </button>
  ) : (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onEnableAutoSign}
        disabled={autoSignLoading}
        title={
          autoSignActive
            ? "Auto-signing active"
            : "Click to enable auto-signing"
        }
        className={`rounded-lg border px-2 py-1 text-sm transition ${
          autoSignActive
            ? "border-[#14532D] bg-[#052e16] text-[#86EFAC]"
            : "border-[#2A2A35] bg-[#16161A] text-[#9CA3AF]"
        } disabled:opacity-60`}
      >
        ⚡
      </button>
      <button
        onClick={openWallet}
        className="rounded-xl border border-[#2A2A35] bg-[#16161A] px-3 py-2 text-sm text-white active:scale-[0.97]"
        type="button"
      >
        <UserDisplay address={initiaAddress} />
      </button>
    </div>
  );

  const rightInfoNode = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-[96px] flex items-center gap-1 rounded-2xl border border-[#2A2A35] bg-[#16161A] px-3 py-1.5 text-right text-xs text-[#D1D5DB]">
        <img src={icon} alt="App Icon" className="h-6 w-6 rounded-full" />
        {balanceLoading && balanceMicro === null ? (
          <span className="inline-block font-semibold h-3 w-14 animate-pulse rounded bg-[#2A2A35]" />
        ) : (
          `APP ${balanceText}`
        )}
      </div>
      <div className="min-w-[96px] rounded-2xl gap-1 border flex items-center border-[#2A2A35] bg-[#16161A] px-3 py-1.5 text-right text-xs text-[#D1D5DB]">
        <img src={icon2} alt="L1 Icon" className="h-6 w-6 rounded-full" />
        {l1BalanceLoading && l1BalanceMicro === null ? (
          <span className="inline-block h-3 w-14 animate-pulse rounded bg-[#2A2A35]" />
        ) : (
          `L1 ${l1BalanceText}`
        )}
      </div>
    </div>
  );

  return (
    <Header
      onDeposit={onOpenDeposit}
      walletNode={walletNode}
      rightInfoNode={rightInfoNode}
    />
  );
}
