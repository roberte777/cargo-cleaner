use anyhow::Result;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::scanner::RustProject;

#[derive(Debug, Clone, Serialize)]
pub struct CleanResult {
    pub project: PathBuf,
    pub freed_bytes: u64,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CleanSummary {
    pub results: Vec<CleanResult>,
    pub total_freed_bytes: u64,
    pub total_cleaned: usize,
    pub total_failed: usize,
}

pub fn clean_projects(projects: &[RustProject], dry_run: bool) -> Result<CleanSummary> {
    let mut results = Vec::new();

    for project in projects {
        if !project.has_target {
            continue;
        }

        let result = if dry_run {
            CleanResult {
                project: project.path.clone(),
                freed_bytes: project.target_size_bytes,
                success: true,
                error: None,
            }
        } else {
            clean_single_project(&project.path, project.target_size_bytes)
        };

        results.push(result);
    }

    let total_freed: u64 = results.iter().filter(|r| r.success).map(|r| r.freed_bytes).sum();
    let total_cleaned = results.iter().filter(|r| r.success).count();
    let total_failed = results.iter().filter(|r| !r.success).count();

    Ok(CleanSummary {
        results,
        total_freed_bytes: total_freed,
        total_cleaned,
        total_failed,
    })
}

fn cargo_bin() -> PathBuf {
    if let Some(home) = dirs::home_dir() {
        let full = home.join(".cargo/bin/cargo");
        if full.exists() {
            return full;
        }
    }
    PathBuf::from("cargo")
}

fn clean_single_project(project_path: &Path, size_before: u64) -> CleanResult {
    let output = Command::new(cargo_bin())
        .arg("clean")
        .current_dir(project_path)
        .output();

    match output {
        Ok(out) if out.status.success() => CleanResult {
            project: project_path.to_path_buf(),
            freed_bytes: size_before,
            success: true,
            error: None,
        },
        Ok(out) => CleanResult {
            project: project_path.to_path_buf(),
            freed_bytes: 0,
            success: false,
            error: Some(String::from_utf8_lossy(&out.stderr).to_string()),
        },
        Err(e) => CleanResult {
            project: project_path.to_path_buf(),
            freed_bytes: 0,
            success: false,
            error: Some(e.to_string()),
        },
    }
}
