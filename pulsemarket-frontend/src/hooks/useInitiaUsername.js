import { useEffect, useMemo, useState } from "react";
import { useUsernameQuery } from "@initia/interwovenkit-react";

const usernameCache = new Map();

function normalizeAddress(address) {
  return (address || "").trim();
}

function shouldFetchUsername(address) {
  return Boolean(address) && !usernameCache.has(address);
}

export function useInitiaUsername(address) {
  const normalizedAddress = normalizeAddress(address);
  const cached = useMemo(() => {
    if (!normalizedAddress) return null;
    if (!usernameCache.has(normalizedAddress)) return undefined;
    return usernameCache.get(normalizedAddress);
  }, [normalizedAddress]);

  const fetchNeeded = shouldFetchUsername(normalizedAddress);
  const queryAddress = fetchNeeded ? normalizedAddress : "";
  const { data, isLoading, error } = useUsernameQuery(queryAddress);
  const [username, setUsername] = useState(cached ?? null);

  useEffect(() => {
    if (!normalizedAddress) {
      setUsername(null);
      return;
    }

    if (usernameCache.has(normalizedAddress)) {
      setUsername(usernameCache.get(normalizedAddress));
      return;
    }

    if (!fetchNeeded) return;
    if (data === undefined) {
      setUsername(null);
      return;
    }

    const resolved = data || null;
    usernameCache.set(normalizedAddress, resolved);
    setUsername(resolved);
  }, [data, fetchNeeded, normalizedAddress]);

  return {
    username,
    loading: fetchNeeded && isLoading,
    error: fetchNeeded ? error : null,
  };
}

export function clearInitiaUsernameCache() {
  usernameCache.clear();
}
