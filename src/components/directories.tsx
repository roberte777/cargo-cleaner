import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Config } from "@/types";

interface DirectoriesProps {
  config: Config;
  onSave: (config: Config) => void;
}

export function Directories({ config, onSave }: DirectoriesProps) {
  const addDirectory = async () => {
    // Use a backend command so the osascript folder picker appears frontmost
    // even when the app runs as ActivationPolicy::Accessory (no dock icon).
    const selected = await invoke<string | null>("pick_directory");
    if (selected) {
      if (config.scan_paths.includes(selected)) return;
      onSave({
        ...config,
        scan_paths: [...config.scan_paths, selected],
      });
    }
  };

  const removeDirectory = (index: number) => {
    onSave({
      ...config,
      scan_paths: config.scan_paths.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4 pt-2">
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Scan Directories</CardTitle>
          <p className="text-xs text-muted-foreground">
            Directories to scan for Rust projects with target/ folders.
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {config.scan_paths.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No directories configured. Add one to get started.
            </p>
          )}
          {config.scan_paths.map((path, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 bg-muted rounded"
            >
              <span className="text-xs font-mono truncate flex-1">{path}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs ml-2 shrink-0"
                onClick={() => removeDirectory(i)}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button onClick={addDirectory} variant="outline" className="w-full">
            Add Directory
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
