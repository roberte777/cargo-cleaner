import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { RustProject, CleanSummary } from "@/types";

export function useCleaning() {
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [projects, setProjects] = useState<RustProject[] | null>(null);
  const [cleanResult, setCleanResult] = useState<CleanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    try {
      setScanning(true);
      setError(null);
      const p = await invoke<RustProject[]>("scan_projects");
      setProjects(p);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }, []);

  const cleanNow = useCallback(async () => {
    try {
      setCleaning(true);
      setError(null);
      const summary = await invoke<CleanSummary>("clean_now");
      setCleanResult(summary);
      return summary;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setCleaning(false);
    }
  }, []);

  return { scanning, cleaning, projects, cleanResult, error, scan, cleanNow };
}
