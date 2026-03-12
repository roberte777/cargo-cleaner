use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RustProject {
    pub path: PathBuf,
    pub target_size_bytes: u64,
    pub has_target: bool,
}

pub fn scan_for_projects(
    scan_paths: &[PathBuf],
    exclude_patterns: &[String],
) -> Result<Vec<RustProject>> {
    let mut projects = Vec::new();

    for scan_path in scan_paths {
        if !scan_path.exists() {
            continue;
        }

        for entry in WalkDir::new(scan_path)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                name != "target"
                    && name != ".git"
                    && name != "node_modules"
                    && !name.starts_with('.')
            })
            .filter_map(|e| e.ok())
        {
            if entry.file_name() == "Cargo.toml" {
                let project_dir = match entry.path().parent() {
                    Some(p) => p.to_path_buf(),
                    None => continue,
                };

                if is_excluded(&project_dir, exclude_patterns) {
                    continue;
                }

                let target_dir = project_dir.join("target");
                let (has_target, size) = if target_dir.exists() && target_dir.is_dir() {
                    (true, dir_size(&target_dir).unwrap_or(0))
                } else {
                    (false, 0)
                };

                projects.push(RustProject {
                    path: project_dir,
                    target_size_bytes: size,
                    has_target,
                });
            }
        }
    }

    projects.sort_by(|a, b| b.target_size_bytes.cmp(&a.target_size_bytes));
    Ok(projects)
}

fn dir_size(path: &Path) -> Result<u64> {
    let mut total: u64 = 0;
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    Ok(total)
}

fn is_excluded(project_path: &Path, patterns: &[String]) -> bool {
    let dir_name = project_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    for pattern in patterns {
        if let Ok(glob_pattern) = glob::Pattern::new(pattern) {
            if glob_pattern.matches(&dir_name) {
                return true;
            }
        }
    }
    false
}
