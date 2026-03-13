import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CleanSummary, Config, Frequency } from "@/types";

interface ScheduleProps {
  config: Config;
  onSave: (config: Config) => void;
  lastRun: string | null;
}

function formatTimeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}


const DAY_OF_WEEK_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const DAY_OF_MONTH_OPTIONS = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export function ScheduleView({ config, onSave, lastRun }: ScheduleProps) {
  const [nextRun, setNextRun] = useState<string>("…");

  const refreshNextRun = useCallback(() => {
    invoke<string | null>("get_next_run").then((ts) => {
      setNextRun(
        ts
          ? new Date(ts).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "—"
      );
    });
  }, []);

  // Fetch on mount and whenever the schedule changes
  useEffect(() => {
    refreshNextRun();
  }, [
    config.schedule.frequency,
    config.schedule.hour,
    config.schedule.minute,
    config.schedule.day_of_week,
    config.schedule.day_of_month,
    refreshNextRun,
  ]);

  // Keep display fresh — re-fetch every minute
  useEffect(() => {
    const id = setInterval(refreshNextRun, 60_000);
    return () => clearInterval(id);
  }, [refreshNextRun]);

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

  const handleUninstallAgent = async () => {
    setAgentLoading(true);
    setAgentError(null);
    try {
      await invoke("uninstall_agent");
      setAgentInstalled(false);
    } catch (e) {
      setAgentError(String(e));
    } finally {
      setAgentLoading(false);
    }
  };

  const updateSchedule = (patch: Partial<Config["schedule"]>) => {
    onSave({
      ...config,
      schedule: { ...config.schedule, ...patch },
    });
  };

  const handleFrequencyChange = (value: string) => {
    updateSchedule({ frequency: value as Frequency });
  };

  const handleTimeChange = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    updateSchedule({ hour: h, minute: m ?? 0 });
  };

  const handleDayOfWeekChange = (value: string) => {
    updateSchedule({ day_of_week: parseInt(value) });
  };

  const handleDayOfMonthChange = (value: string) => {
    updateSchedule({ day_of_month: parseInt(value) });
  };

  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<CleanSummary | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);

  const handleDryRunNow = async () => {
    setDryRunLoading(true);
    setDryRunResult(null);
    setDryRunError(null);
    try {
      const result = await invoke<CleanSummary>("dry_run_now");
      setDryRunResult(result);
    } catch (e) {
      setDryRunError(String(e));
    } finally {
      setDryRunLoading(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Cleanup Schedule</CardTitle>
          <p className="text-xs text-muted-foreground">
            How often to clean target/ directories.
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select
              value={config.schedule.frequency}
              onValueChange={handleFrequencyChange}
            >
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.schedule.frequency === "weekly" && (
            <div className="space-y-2">
              <Label htmlFor="day-of-week">Day of Week</Label>
              <Select
                value={String(config.schedule.day_of_week ?? 0)}
                onValueChange={handleDayOfWeekChange}
              >
                <SelectTrigger id="day-of-week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OF_WEEK_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {config.schedule.frequency === "monthly" && (
            <div className="space-y-2">
              <Label htmlFor="day-of-month">Day of Month</Label>
              <Select
                value={String(config.schedule.day_of_month ?? 1)}
                onValueChange={handleDayOfMonthChange}
              >
                <SelectTrigger id="day-of-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OF_MONTH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Limited to 1-28 to work in all months.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <input
              id="time"
              type="time"
              value={formatTimeValue(config.schedule.hour, config.schedule.minute ?? 0)}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
            <div>
              Next run:{" "}
              <span className="text-foreground font-medium">{nextRun}</span>
            </div>
            {lastRun && (
              <div>
                Last ran:{" "}
                <span className="text-foreground font-medium">
                  {new Date(lastRun).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Dry Run</CardTitle>
          <p className="text-xs text-muted-foreground">
            Preview what would be cleaned without deleting anything.
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Button
            variant="outline"
            size="sm"
            disabled={dryRunLoading}
            onClick={handleDryRunNow}
          >
            {dryRunLoading ? "Running…" : "Dry Run Now"}
          </Button>
          {dryRunError && (
            <p className="text-xs text-destructive">{dryRunError}</p>
          )}
          {dryRunResult && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <div>
                Projects scanned:{" "}
                <span className="text-foreground font-medium">
                  {dryRunResult.results.length}
                </span>
              </div>
              <div>
                Would free:{" "}
                <span className="text-foreground font-medium">
                  {dryRunResult.total_freed_bytes >= 1_073_741_824
                    ? `${(dryRunResult.total_freed_bytes / 1_073_741_824).toFixed(1)} GB`
                    : `${(dryRunResult.total_freed_bytes / 1_048_576).toFixed(1)} MB`}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">LaunchAgent</CardTitle>
            {agentInstalled === true && (
              <Badge variant="secondary" className="text-xs">Installed</Badge>
            )}
            {agentInstalled === false && (
              <Badge variant="outline" className="text-xs text-muted-foreground">Not installed</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Runs <code className="font-mono">cargo-cleaner run</code> on your configured schedule.
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={agentInstalled !== false || agentLoading}
              onClick={handleInstallAgent}
            >
              {agentLoading && !agentInstalled ? "Installing..." : "Install"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={agentInstalled !== true || agentLoading}
              onClick={handleUninstallAgent}
            >
              {agentLoading && agentInstalled ? "Uninstalling..." : "Uninstall"}
            </Button>
          </div>
          {agentError && (
            <p className="text-xs text-destructive">{agentError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            If you delete this app without uninstalling, run the uninstall script:<br />
            <code className="font-mono break-all">
              ~/Library/Application\ Support/cargo-cleaner/uninstall.sh
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
