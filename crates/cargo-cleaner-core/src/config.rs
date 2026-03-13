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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Frequency {
    Daily,
    Weekly,
    Monthly,
}

impl Default for Frequency {
    fn default() -> Self {
        Frequency::Weekly
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Schedule {
    pub frequency: Frequency,
    pub hour: u32,
    pub minute: u32,
    pub day_of_week: Option<u32>,
    pub day_of_month: Option<u32>,
}

impl Default for Schedule {
    fn default() -> Self {
        Self {
            frequency: Frequency::Weekly,
            hour: 2,
            minute: 0,
            day_of_week: Some(0), // Sunday
            day_of_month: Some(1),
        }
    }
}

impl Schedule {
    pub fn interval_days(&self) -> u32 {
        match self.frequency {
            Frequency::Daily => 1,
            Frequency::Weekly => 7,
            Frequency::Monthly => 30,
        }
    }
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
            schedule: Schedule::default(),
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
            let config: Config = serde_json::from_str(&contents)?;
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
