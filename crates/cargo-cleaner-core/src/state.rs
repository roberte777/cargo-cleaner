use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppState {
    pub last_run: Option<DateTime<Utc>>,
    pub total_space_freed_bytes: u64,
    pub total_projects_cleaned: u64,
    pub last_cleaned_projects: Vec<PathBuf>,
}

impl AppState {
    pub fn state_path() -> Result<PathBuf> {
        let dir = crate::config::Config::config_dir()?;
        Ok(dir.join("state.json"))
    }

    pub fn load() -> Result<Self> {
        let path = Self::state_path()?;
        if path.exists() {
            let contents = std::fs::read_to_string(&path)?;
            Ok(serde_json::from_str(&contents)?)
        } else {
            Ok(AppState::default())
        }
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::state_path()?;
        let contents = serde_json::to_string_pretty(self)?;
        std::fs::write(path, contents)?;
        Ok(())
    }

    pub fn record_cleanup(&mut self, freed_bytes: u64, projects: Vec<PathBuf>) {
        self.last_run = Some(Utc::now());
        self.total_space_freed_bytes += freed_bytes;
        self.total_projects_cleaned += projects.len() as u64;
        self.last_cleaned_projects = projects;
    }

    pub fn total_space_freed_gb(&self) -> f64 {
        self.total_space_freed_bytes as f64 / 1_073_741_824.0
    }
}
