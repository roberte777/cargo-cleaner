import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppState } from "@/types";

export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    try {
      const s = await invoke<AppState>("get_state");
      setState(s);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      // Always clear the initial loading flag; subsequent reloads don't set it
      // back to true so the full-screen loader never remounts tab content.
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  return { state, loading, error, reload: loadState };
}
