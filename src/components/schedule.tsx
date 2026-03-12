import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Config } from "@/types";

interface ScheduleProps {
  config: Config;
  nextRun: string | null;
  onSave: (config: Config) => void;
}

const INTERVAL_OPTIONS = [
  { value: "1", label: "Daily" },
  { value: "3", label: "Every 3 days" },
  { value: "7", label: "Weekly" },
  { value: "14", label: "Every 2 weeks" },
  { value: "30", label: "Monthly" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  return date.toLocaleString();
}

export function ScheduleView({ config, nextRun, onSave }: ScheduleProps) {
  const handleIntervalChange = (value: string) => {
    onSave({
      ...config,
      schedule: { ...config.schedule, interval_days: parseInt(value) },
    });
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSave({
      ...config,
      schedule: { ...config.schedule, preferred_time: e.target.value },
    });
  };

  const handleDryRunChange = (checked: boolean) => {
    onSave({ ...config, dry_run: checked });
  };

  return (
    <div className="space-y-4 pt-2">
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Cleanup Interval</CardTitle>
          <p className="text-xs text-muted-foreground">
            How often to clean target/ directories. The cleaner runs at most
            this often, even if the machine was off.
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="interval">Interval</Label>
            <Select
              value={String(config.schedule.interval_days)}
              onValueChange={handleIntervalChange}
            >
              <SelectTrigger id="interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferred-time">Preferred Time</Label>
            <Input
              id="preferred-time"
              type="time"
              value={config.schedule.preferred_time}
              onChange={handleTimeChange}
            />
            <p className="text-xs text-muted-foreground">
              The LaunchAgent fires at this time each day. If the interval
              hasn't elapsed yet, it skips quietly.
            </p>
          </div>

          {nextRun && (
            <p className="text-sm text-muted-foreground">
              Next scheduled run:{" "}
              <span className="font-medium text-foreground">
                {formatDate(nextRun)}
              </span>
            </p>
          )}
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
    </div>
  );
}
