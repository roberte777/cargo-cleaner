import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import type { Config, Frequency } from "@/types";

interface ScheduleProps {
  config: Config;
  onSave: (config: Config) => void;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const ampm = i < 12 ? "AM" : "PM";
  const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return { value: String(i), label: `${h12}:00 ${ampm}` };
});

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

export function ScheduleView({ config, onSave }: ScheduleProps) {
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

  const handleHourChange = (value: string) => {
    updateSchedule({ hour: parseInt(value) });
  };

  const handleDayOfWeekChange = (value: string) => {
    updateSchedule({ day_of_week: parseInt(value) });
  };

  const handleDayOfMonthChange = (value: string) => {
    updateSchedule({ day_of_month: parseInt(value) });
  };

  const handleDryRunChange = (checked: boolean) => {
    onSave({ ...config, dry_run: checked });
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
            <Label htmlFor="hour">Hour</Label>
            <Select
              value={String(config.schedule.hour)}
              onValueChange={handleHourChange}
            >
              <SelectTrigger id="hour">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Dry Run Mode</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="dry-run">Enable Dry Run</Label>
              <p className="text-xs text-muted-foreground">
                Preview what would be cleaned without actually deleting
                anything.
              </p>
            </div>
            <Switch
              id="dry-run"
              checked={config.dry_run}
              onCheckedChange={handleDryRunChange}
            />
          </div>
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
