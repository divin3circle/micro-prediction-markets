import { Link, NavLink, useLocation } from "react-router-dom";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { APPCHAIN_NAME } from "../config/chain";
import { UserDisplay } from "./UserDisplay";

export function TopNav({
  autoSignActive,
  onEnableAutoSign,
  autoSignLoading,
  onOpenDeposit,
  balanceMicro,
  balanceLoading,
}) {
  const { initiaAddress, openConnect, openWallet } = useInterwovenKit();
  const location = useLocation();
  const balanceText =
    typeof balanceMicro === "number"
      ? `${(balanceMicro / 1_000_000).toLocaleString(undefined, {
          maximumFractionDigits: 3,
        })} INIT`
      : "0 INIT";

  return (
    <header className="sticky top-0 z-40 border-b border-[#2A2A35] bg-[#0D0D0F]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[980px] items-center justify-between px-4 py-4">
        <div className="flex items-center gap-5">
          <Link to="/" className="text-xl font-semibold tracking-tight">
            <span className="text-white">PULSE</span>{" "}
            <span className="text-[#7C5CFC]">MARKET</span>
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-sm ${
                  isActive
                    ? "bg-[#7C5CFC] text-white"
                    : "text-[#A1A1B0] hover:text-white"
                }`
              }
            >
              Markets
            </NavLink>
            <NavLink
              to="/positions"
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-sm ${
                  isActive
                    ? "bg-[#7C5CFC] text-white"
                    : "text-[#A1A1B0] hover:text-white"
                }`
              }
            >
              My Positions
            </NavLink>
            <NavLink
              to="/create"
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-sm ${
                  isActive
                    ? "bg-[#7C5CFC] text-white"
                    : "text-[#A1A1B0] hover:text-white"
                }`
              }
            >
              Create
            </NavLink>
            {location.pathname.startsWith("/admin") && (
              <span className="rounded-full bg-[#232334] px-3 py-1.5 text-sm text-[#CFCFFF]">
                Admin
              </span>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenDeposit}
            className="rounded-xl border border-[#2A2A35] bg-[#16161A] px-3 py-2 text-sm text-white shadow-sm active:scale-[0.97]"
            type="button"
          >
            Deposit
          </button>

          {!initiaAddress ? (
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
              <div className="min-w-[88px] rounded-xl border border-[#2A2A35] bg-[#16161A] px-3 py-2 text-right text-xs text-[#D1D5DB]">
                {balanceLoading && balanceMicro === null ? (
                  <span className="inline-block h-3 w-14 animate-pulse rounded bg-[#2A2A35]" />
                ) : (
                  balanceText
                )}
              </div>
            </div>
          )}

          <div className="hidden items-center gap-2 rounded-xl bg-[#16161A] px-3 py-2 text-xs text-[#A1A1B0] md:flex">
            <span className="inline-block h-2 w-2 rounded-full bg-[#22C55E]" />
            <span>{APPCHAIN_NAME}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
