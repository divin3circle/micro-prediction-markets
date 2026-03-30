import { Navigate, Route, Routes } from "react-router-dom";
import { PositionsView } from "../components/PositionsView";
import { StatsView } from "../components/StatsView";
import CreateMarketView from "../components/CreateMarketView";
import { MarketsPage } from "../pages/MarketsPage";

export function AppRoutes({
  onOpenBet,
  markets,
  loading,
  error,
  onRefresh,
  initiaAddress,
  balanceMicro,
  balanceLoading,
  onOpenDeposit,
  positions,
  loadingPositions,
  onClaimWin,
  onClaimRefund,
  creationFee,
  onConnect,
  onCreateMarket,
}) {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <MarketsPage
            onOpenBet={onOpenBet}
            markets={markets}
            loading={loading}
            error={error}
            onRefresh={onRefresh}
            isConnected={Boolean(initiaAddress)}
            balanceMicro={balanceMicro}
            balanceLoading={balanceLoading}
            onOpenDeposit={onOpenDeposit}
          />
        }
      />
      <Route
        path="/positions"
        element={
          <PositionsView
            positions={positions}
            loading={loadingPositions}
            currentAddress={initiaAddress}
            onClaimWin={onClaimWin}
            onClaimRefund={onClaimRefund}
          />
        }
      />
      <Route path="/stats" element={<StatsView />} />
      <Route
        path="/create"
        element={
          <CreateMarketView
            initiaAddress={initiaAddress}
            creationFee={creationFee}
            onConnect={onConnect}
            onCreateMarket={onCreateMarket}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
