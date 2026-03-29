import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getActiveMarketIds,
  getMarket,
  getMarketCount,
  getUserPosition,
} from "../lib/pulseMarketApi";

function sortByCloseTime(markets) {
  return [...markets].sort((a, b) => a.closeTime - b.closeTime);
}

export function usePulseMarkets() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const ids = await getActiveMarketIds();
      const full = await Promise.all(ids.map((id) => getMarket(id)));
      setMarkets(sortByCloseTime(full));
    } catch (e) {
      setError(e?.message || "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      await refresh();
      if (!mounted) return;
    };
    run();

    const timer = setInterval(refresh, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [refresh]);

  return { markets, loading, error, refresh };
}

export function useUserPositions(userAddress) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userAddress) {
      setPositions([]);
      return;
    }

    setLoading(true);
    try {
      const count = await getMarketCount();
      const ids = Array.from({ length: count }, (_, i) => i);
      const markets = await Promise.all(ids.map((id) => getMarket(id)));
      const pos = await Promise.all(
        ids.map((id) => getUserPosition(id, userAddress)),
      );

      const joined = markets
        .map((market, index) => ({ market, position: pos[index] }))
        .filter(
          ({ position }) => position.yesAmount > 0 || position.noAmount > 0,
        );

      setPositions(joined);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const grouped = useMemo(() => positions, [positions]);

  return { positions: grouped, loading, refresh };
}
