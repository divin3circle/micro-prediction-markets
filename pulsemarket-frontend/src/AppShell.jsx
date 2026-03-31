import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { TopNav } from "./components/TopNav";
import { BetModal } from "./components/BetModal";
import { Toast } from "./components/Toast";
import { DepositPendingPill } from "./components/DepositPendingPill";
import { StatsFabButton } from "./components/StatsFabButton";
import { usePulseMarkets, useUserPositions } from "./hooks/usePulseMarkets";
import { usePulseMarketTx } from "./lib/pulseMarketApi";
import { useBalances } from "./hooks/useBalances";
import { useFlashMessage } from "./hooks/useFlashMessage";
import { useTransactionActions } from "./hooks/useTransactionActions";
import { useBetModal } from "./hooks/useBetModal";
import { useAutoSignSession } from "./context/AutoSignSessionContext";
import { AppRoutes } from "./routes/AppRoutes";

export function AppShell() {
  const navigate = useNavigate();
  const { initiaAddress, openConnect, openBridge } = useInterwovenKit();
  const { sessionActive, initializeSession, isInitializing } =
    useAutoSignSession();

  const tx = usePulseMarketTx();
  const { markets, loading, error, refresh } = usePulseMarkets();
  const {
    positions,
    loading: loadingPositions,
    refresh: refreshPositions,
  } = useUserPositions(initiaAddress);
  const { toast, setFlash } = useFlashMessage();
  const {
    creationFee,
    balanceMicro,
    balanceLoading,
    hasLoadedBalance,
    l1BalanceMicro,
    l1BalanceLoading,
    hasLoadedL1Balance,
    depositPending,
    openDepositBridge,
  } = useBalances({
    initiaAddress,
    openConnect,
    openBridge,
    setFlash,
  });
  const { betState, openBet, closeBet } = useBetModal();
  const { runAndSync } = useTransactionActions({
    setFlash,
    refreshMarkets: refresh,
    refreshPositions,
  });

  const [betResultModal, setBetResultModal] = useState({
    open: false,
    kind: "success",
    title: "",
    message: "",
  });

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(124,92,252,0.22),transparent_48%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.12),transparent_52%),linear-gradient(180deg,#0A0A0E_0%,#050507_100%)]" />
      <TopNav
        autoSignActive={sessionActive}
        autoSignLoading={isInitializing}
        onOpenDeposit={openDepositBridge}
        balanceMicro={balanceMicro}
        balanceLoading={balanceLoading && !hasLoadedBalance}
        l1BalanceMicro={l1BalanceMicro}
        l1BalanceLoading={l1BalanceLoading && !hasLoadedL1Balance}
        onEnableAutoSign={async () => {
          if (!initiaAddress) {
            openConnect?.();
            return;
          }
          try {
            setFlash(
              "Allow PulseMarket to place bets on your behalf during this session",
            );
            await initializeSession();
            setFlash("Auto-signing active");
          } catch (e) {
            setFlash(e?.message || "Failed to enable auto-signing");
          }
        }}
      />
      <Toast message={toast} />

      {betResultModal.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2A2A35] bg-[#16161A] p-5 shadow-2xl">
            <div className="mb-3 flex items-center gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-full text-lg ${
                  betResultModal.kind === "success"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-red-500/15 text-red-300"
                }`}
              >
                {betResultModal.kind === "success" ? "✓" : "!"}
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  {betResultModal.title}
                </p>
                <p className="text-sm text-[#A1A1B0]">
                  {betResultModal.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setBetResultModal({
                  open: false,
                  kind: "success",
                  title: "",
                  message: "",
                })
              }
              className="mt-2 h-11 w-full rounded-xl bg-[#7C5CFC] text-white hover:bg-[#6B4CDC]"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[980px] px-4 pb-24 pt-6">
        <AppRoutes
          onOpenBet={openBet}
          markets={markets}
          loading={loading}
          error={error}
          onRefresh={refresh}
          initiaAddress={initiaAddress}
          balanceMicro={balanceMicro}
          balanceLoading={balanceLoading}
          onOpenDeposit={openDepositBridge}
          positions={positions}
          loadingPositions={loadingPositions}
          creationFee={creationFee}
          onConnect={openConnect}
          onClaimWin={(id) =>
            runAndSync(
              () => tx.claimWinnings(id),
              "Winnings claimed successfully",
              { requiresAutoSign: true },
            )
          }
          onClaimRefund={(id) =>
            runAndSync(() => tx.claimRefund(id), "Refund claimed", {
              requiresAutoSign: true,
            })
          }
          onCreateMarket={async (payload) => {
            const ok = await runAndSync(
              () => tx.createMarket(payload),
              "Market created",
              { requiresAutoSign: false },
            );
            if (ok) {
              await refresh();
              navigate("/");
            }
          }}
        />

        <StatsFabButton onClick={() => navigate("/stats")} />
      </main>

      <BetModal
        open={betState.open}
        market={betState.market}
        initialSide={betState.side}
        connectedAddress={initiaAddress}
        onClose={closeBet}
        onPlace={async (payload) => {
          const { onAutoSignStart, onTxStart, ...txPayload } = payload;

          try {
            if (!sessionActive) {
              onAutoSignStart?.();
              setFlash(
                "Allow PulseMarket to place bets on your behalf during this session",
              );
              await initializeSession();
            }

            onTxStart?.();
            const ok = await runAndSync(
              () => tx.placeBet(txPayload),
              "Bet placed",
              {
                requiresAutoSign: true,
                skipAutoSignInit: true,
              },
            );

            if (ok) {
              setBetResultModal({
                open: true,
                kind: "success",
                title: "Bet placed successfully",
                message: "Your position has been submitted on-chain.",
              });
            } else {
              setBetResultModal({
                open: true,
                kind: "error",
                title: "Bet failed",
                message: "We could not place your bet. Please try again.",
              });
            }

            return ok;
          } catch (e) {
            setBetResultModal({
              open: true,
              kind: "error",
              title: "Bet failed",
              message:
                e?.message || "We could not place your bet. Please try again.",
            });
            return false;
          }
        }}
      />

      <DepositPendingPill depositPending={depositPending} />
    </div>
  );
}
