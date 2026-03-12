export interface Config {
  scan_paths: string[];
  schedule: Schedule;
  permission_mode: "always_ask" | "dont_ask_windows" | "never_ask";
  dont_ask_windows: TimeWindow[];
  exclude_patterns: string[];
  dry_run: boolean;
}

export interface Schedule {
  interval_days: number;
  preferred_time: string;
}

export interface TimeWindow {
  start: number;
  end: number;
}

export interface AppState {
  last_run: string | null;
  total_space_freed_bytes: number;
  total_projects_cleaned: number;
  last_cleaned_projects: string[];
}

export interface RustProject {
  path: string;
  target_size_bytes: number;
  has_target: boolean;
}

export interface CleanResult {
  project: string;
  freed_bytes: number;
  success: boolean;
  error: string | null;
}

export interface CleanSummary {
  results: CleanResult[];
  total_freed_bytes: number;
  total_cleaned: number;
  total_failed: number;
}
