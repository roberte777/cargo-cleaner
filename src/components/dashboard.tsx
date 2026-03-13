import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { AppState, Config, CleanSummary } from "@/types";

interface DashboardProps {
  state: AppState;
  config: Config;
  onCleanComplete: () => void;
  onRefresh: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  return date.toLocaleString();
}

export function Dashboard({ state, config, onCleanComplete, onRefresh }: DashboardProps) {
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<CleanSummary | null>(null);
  const [agentInstalled, setAgentInstalled] = useState<boolean | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  useEffect(() => {
    invoke<boolean>("get_agent_status").then(setAgentInstalled);
  }, []);

  const handleInstallAgent = async () => {
    setAgentLoading(true);
    setAgentError(null);
    try {
      await invoke("install_agent");
      setAgentInstalled(true);
    } catch (e) {
      setAgentError(String(e));
    } finally {
      setAgentLoading(false);
    }
  };

  const handleCleanNow = async () => {
    setCleaning(true);
    setResult(null);
    try {
      const summary = await invoke<CleanSummary>("clean_now");
      setResult(summary);
      onCleanComplete();
    } catch (e) {
      console.error(e);
    } finally {
      setCleaning(false);
    }
  };

  const modeLabel = {
    always_ask: "Always Ask",
    dont_ask_windows: "Don't Ask (Windows)",
    never_ask: "Never Ask",
  }[config.permission_mode];

  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Total Space Freed
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">
              {formatBytes(state.total_space_freed_bytes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Projects Cleaned
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{state.total_projects_cleaned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Last Cleanup
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm font-medium">{formatDate(state.last_run)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Permission Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm font-medium">{modeLabel}</p>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={handleCleanNow}
        disabled={cleaning}
        className="w-full"
        size="lg"
      >
        {cleaning ? "Cleaning..." : "Clean Now"}
      </Button>

      {cleaning && <Progress className="w-full" />}

      {result && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              Cleaned {result.total_cleaned} project(s), freed{" "}
              {formatBytes(result.total_freed_bytes)}
              {result.total_failed > 0 && (
                <Badge variant="destructive">{result.total_failed} failed</Badge>
              )}
            </CardTitle>
          </CardHeader>
          {result.results.length > 0 && (
            <CardContent className="px-4 pb-4">
              <div className="max-h-32 overflow-y-auto">
                {result.results.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1 border-b last:border-0"
                  >
                    <span className="text-xs font-mono truncate flex-1">
                      {r.project}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {formatBytes(r.freed_bytes)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {!result && state.last_cleaned_projects.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Last Cleaned Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="max-h-32 overflow-y-auto">
              {state.last_cleaned_projects.map((p, i) => (
                <p key={i} className="text-xs font-mono py-1 border-b last:border-0 truncate" title={p}>
                  {p}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show LaunchAgent card only when not installed */}
      {agentInstalled === false && (
        <>
          <Separator />
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">LaunchAgent</CardTitle>
                <Badge variant="outline" className="text-xs text-muted-foreground">Not installed</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Install the LaunchAgent to run <code className="font-mono">cargo-cleaner run</code> on your configured schedule.
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <Button
                variant="outline"
                size="sm"
                disabled={agentLoading}
                onClick={handleInstallAgent}
              >
                {agentLoading ? "Installing..." : "Install"}
              </Button>
              {agentError && (
                <p className="text-xs text-destructive">{agentError}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
