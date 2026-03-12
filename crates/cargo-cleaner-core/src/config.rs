use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub scan_paths: Vec<PathBuf>,
    pub schedule: Schedule,
    pub permission_mode: PermissionMode,
    pub dont_ask_windows: Vec<TimeWindow>,
    pub exclude_patterns: Vec<String>,
    pub dry_run: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schedule {
    pub interval_days: u32,
    pub preferred_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionMode {
    AlwaysAsk,
    DontAskWindows,
    NeverAsk,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeWindow {
    pub start: u32,
    pub end: u32,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            scan_paths: Vec::new(),
            schedule: Schedule {
                interval_days: 7,
                preferred_time: "02:00".to_string(),
            },
            permission_mode: PermissionMode::AlwaysAsk,
            dont_ask_windows: Vec::new(),
            exclude_patterns: Vec::new(),
            dry_run: false,
        }
    }
}

impl Config {
    pub fn config_dir() -> Result<PathBuf> {
        let dir = dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("Cannot determine config directory"))?
            .join("cargo-cleaner");
        std::fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    pub fn config_path() -> Result<PathBuf> {
        Ok(Self::config_dir()?.join("config.json"))
    }

    pub fn load() -> Result<Self> {
        let path = Self::config_path()?;
        if path.exists() {
            let contents = std::fs::read_to_string(&path)?;
            let mut config: Config = serde_json::from_str(&contents)?;
            // Migrate: empty preferred_time is invalid — the browser's time
            // input emits a spurious system-default value on first interaction
            // when given an empty string, causing the field to appear to reset.
            if config.schedule.preferred_time.is_empty() {
                config.schedule.preferred_time = "02:00".to_string();
                config.save()?;
            }
            Ok(config)
        } else {
            let config = Config::default();
            config.save()?;
            Ok(config)
        }
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::config_path()?;
        let contents = serde_json::to_string_pretty(self)?;
        std::fs::write(path, contents)?;
        Ok(())
    }
}
