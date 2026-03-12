import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Config } from "@/types";

export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const c = await invoke<Config>("get_config");
      setConfig(c);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      // Always clear the initial loading flag; subsequent reloads skip setLoading(true)
      // so the full-screen loader never remounts tab content.
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (newConfig: Config) => {
    // Update in-memory state immediately (optimistic) so the UI never shows
    // stale values while the async disk write is in flight.
    setConfig(newConfig);
    try {
      await invoke("save_config", { newConfig });
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return { config, loading, error, saveConfig, reloadConfig: loadConfig };
}
