import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Config } from "@/types";

interface ExclusionsProps {
  config: Config;
  onSave: (config: Config) => void;
}

export function Exclusions({ config, onSave }: ExclusionsProps) {
  const [newPattern, setNewPattern] = useState("");

  const addPattern = () => {
    const trimmed = newPattern.trim();
    if (!trimmed || config.exclude_patterns.includes(trimmed)) return;
    onSave({
      ...config,
      exclude_patterns: [...config.exclude_patterns, trimmed],
    });
    setNewPattern("");
  };

  const removePattern = (index: number) => {
    onSave({
      ...config,
      exclude_patterns: config.exclude_patterns.filter((_, i) => i !== index),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addPattern();
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Exclusion Patterns</CardTitle>
          <p className="text-xs text-muted-foreground">
            Glob patterns for project directories to never clean. Matched
            against the directory name (e.g., <code>important-*</code> matches{" "}
            <code>important-project</code>).
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {config.exclude_patterns.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No exclusion patterns. All discovered projects will be cleaned.
            </p>
          )}
          {config.exclude_patterns.map((pattern, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 bg-muted rounded"
            >
              <code className="text-xs font-mono">{pattern}</code>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs ml-2 shrink-0"
                onClick={() => removePattern(i)}
              >
                Remove
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="e.g., important-*"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-sm"
            />
            <Button onClick={addPattern} variant="outline" className="shrink-0">
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
