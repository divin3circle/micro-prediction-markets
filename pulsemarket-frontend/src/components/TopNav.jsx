import { Link, NavLink, useLocation } from "react-router-dom";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { APPCHAIN_NAME } from "../config/chain";

function truncate(value) {
  if (!value) return "";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export function TopNav() {
  const { initiaAddress, username, openConnect, openWallet, openBridge } =
    useInterwovenKit();
  const location = useLocation();

  const label = username || truncate(initiaAddress);

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
            {location.pathname.startsWith("/admin") && (
              <span className="rounded-full bg-[#232334] px-3 py-1.5 text-sm text-[#CFCFFF]">
                Admin
              </span>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              openBridge?.({ srcChainId: "initiation-2", srcDenom: "uinit" })
            }
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
            <button
              onClick={openWallet}
              className="rounded-xl border border-[#2A2A35] bg-[#16161A] px-3 py-2 text-sm text-white active:scale-[0.97]"
              type="button"
            >
              {label}
            </button>
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
