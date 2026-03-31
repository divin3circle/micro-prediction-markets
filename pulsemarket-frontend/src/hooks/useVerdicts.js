import { useEffect, useState } from "react";
import { agentApi } from "../lib/agentApi";

export function useVerdicts() {
  const [verdicts, setVerdicts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    agentApi
      .getVerdicts()
      .then((data) => {
        if (mounted) setVerdicts(data);
      })
      .catch((e) => {
        if (mounted) setError(e.message || "Failed to load verdicts");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { verdicts, loading, error };
}
