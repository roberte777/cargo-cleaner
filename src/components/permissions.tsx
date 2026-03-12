import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Config, TimeWindow } from "@/types";

interface PermissionsProps {
  config: Config;
  onSave: (config: Config) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

export function Permissions({ config, onSave }: PermissionsProps) {
  const handleModeChange = (value: string) => {
    onSave({
      ...config,
      permission_mode: value as Config["permission_mode"],
    });
  };

  const addWindow = () => {
    onSave({
      ...config,
      dont_ask_windows: [...config.dont_ask_windows, { start: 2, end: 6 }],
    });
  };

  const removeWindow = (index: number) => {
    onSave({
      ...config,
      dont_ask_windows: config.dont_ask_windows.filter((_, i) => i !== index),
    });
  };

  const updateWindow = (
    index: number,
    field: keyof TimeWindow,
    value: number
  ) => {
    const updated = config.dont_ask_windows.map((w, i) =>
      i === index ? { ...w, [field]: value } : w
    );
    onSave({ ...config, dont_ask_windows: updated });
  };

  return (
    <div className="space-y-4 pt-2">
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Permission Mode</CardTitle>
          <p className="text-xs text-muted-foreground">
            Controls whether the cleaner asks before cleaning.
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <RadioGroup
            value={config.permission_mode}
            onValueChange={handleModeChange}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="always_ask" id="always_ask" className="mt-0.5" />
              <div>
                <Label htmlFor="always_ask" className="font-medium">
                  Always Ask
                </Label>
                <p className="text-xs text-muted-foreground">
                  Shows a dialog before every cleanup. Safest option.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem
                value="dont_ask_windows"
                id="dont_ask_windows"
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="dont_ask_windows" className="font-medium">
                  Don't Ask During Windows
                </Label>
                <p className="text-xs text-muted-foreground">
                  Auto-cleans during specified hours, asks at other times.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="never_ask" id="never_ask" className="mt-0.5" />
              <div>
                <Label htmlFor="never_ask" className="font-medium">
                  Never Ask
                </Label>
                <p className="text-xs text-muted-foreground">
                  Always auto-cleans without prompting.
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {config.permission_mode === "dont_ask_windows" && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Auto-Clean Windows</CardTitle>
            <p className="text-xs text-muted-foreground">
              During these hours, cleanup runs automatically without asking.
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* 24-hour visual bar */}
            <div className="space-y-1">
              <div className="flex h-6 rounded overflow-hidden border">
                {HOURS.map((h) => {
                  const isActive = config.dont_ask_windows.some((w) => {
                    if (w.start <= w.end) {
                      return h >= w.start && h < w.end;
                    }
                    return h >= w.start || h < w.end;
                  });
                  return (
                    <div
                      key={h}
                      className={`flex-1 ${isActive ? "bg-primary" : "bg-muted"}`}
                      title={formatHour(h)}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>12 AM</span>
              </div>
            </div>

            {config.dont_ask_windows.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={String(w.start)}
                  onValueChange={(v) => updateWindow(i, "start", parseInt(v))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatHour(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">to</span>
                <Select
                  value={String(w.end)}
                  onValueChange={(v) => updateWindow(i, "end", parseInt(v))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatHour(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => removeWindow(i)}
                >
                  Remove
                </Button>
              </div>
            ))}

            <Button onClick={addWindow} variant="outline" size="sm">
              Add Window
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
