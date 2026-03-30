import { useCallback, useEffect, useRef, useState } from "react";

export function useFlashMessage() {
  const [toast, setToast] = useState("");
  const timeoutRef = useRef(null);

  const setFlash = useCallback((message) => {
    setToast(message);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setToast(""), 2800);
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return { toast, setFlash };
}
