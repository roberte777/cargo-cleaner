use std::sync::Mutex;

use cargo_cleaner_core::{cleaner, launchagent, scanner, scheduler, AppState, CleanSummary, Config, RustProject};

struct ConfigState(Mutex<Config>);
struct AppStateWrapper(Mutex<AppState>);

#[tauri::command]
fn get_config(config: tauri::State<ConfigState>) -> Result<Config, String> {
    Ok(config.0.lock().unwrap().clone())
}

fn cli_path() -> Result<String, String> {
    Ok(std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .unwrap()
        .join("cargo-cleaner")
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
fn save_config(config: tauri::State<ConfigState>, new_config: Config) -> Result<(), String> {
    let mut c = config.0.lock().unwrap();
    let schedule_changed = c.schedule.frequency != new_config.schedule.frequency
        || c.schedule.hour != new_config.schedule.hour
        || c.schedule.minute != new_config.schedule.minute
        || c.schedule.day_of_week != new_config.schedule.day_of_week
        || c.schedule.day_of_month != new_config.schedule.day_of_month;
    *c = new_config;
    c.save().map_err(|e| e.to_string())?;

    // If the agent is installed and the schedule changed, regenerate the
    // plist immediately so the new schedule takes effect without reinstalling.
    if schedule_changed && launchagent::is_installed() {
        let path = cli_path()?;
        launchagent::install(&path, &c.schedule).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn get_state(state: tauri::State<AppStateWrapper>) -> Result<AppState, String> {
    // Re-read from disk so we pick up changes made by the CLI / LaunchAgent.
    let fresh = AppState::load().map_err(|e| e.to_string())?;
    let mut s = state.0.lock().unwrap();
    *s = fresh.clone();
    Ok(fresh)
}

#[tauri::command]
async fn scan_projects(config: tauri::State<'_, ConfigState>) -> Result<Vec<RustProject>, String> {
    let c = config.0.lock().unwrap().clone();
    scanner::scan_for_projects(&c.scan_paths, &c.exclude_patterns).map_err(|e| e.to_string())
}

#[tauri::command]
async fn clean_now(
    config: tauri::State<'_, ConfigState>,
    state: tauri::State<'_, AppStateWrapper>,
) -> Result<CleanSummary, String> {
    let c = config.0.lock().unwrap().clone();
    let projects =
        scanner::scan_for_projects(&c.scan_paths, &c.exclude_patterns).map_err(|e| e.to_string())?;
    let summary = cleaner::clean_projects(&projects, c.dry_run).map_err(|e| e.to_string())?;

    if !c.dry_run {
        let mut s = state.0.lock().unwrap();
        let cleaned_paths: Vec<_> = summary
            .results
            .iter()
            .filter(|r| r.success)
            .map(|r| r.project.clone())
            .collect();
        s.record_cleanup(summary.total_freed_bytes, cleaned_paths);
        s.save().map_err(|e| e.to_string())?;
    }

    Ok(summary)
}

#[tauri::command]
async fn dry_run_now(
    config: tauri::State<'_, ConfigState>,
) -> Result<CleanSummary, String> {
    let c = config.0.lock().unwrap().clone();
    let projects =
        scanner::scan_for_projects(&c.scan_paths, &c.exclude_patterns).map_err(|e| e.to_string())?;
    cleaner::clean_projects(&projects, true).map_err(|e| e.to_string())
}

#[tauri::command]
fn pick_directory() -> Result<Option<String>, String> {
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg("POSIX path of (choose folder with prompt \"Select a directory to scan:\")")
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let raw = String::from_utf8_lossy(&output.stdout);
        let path = raw.trim().trim_end_matches('/').to_string();
        Ok(if path.is_empty() { None } else { Some(path) })
    } else {
        Ok(None) // user cancelled
    }
}

#[tauri::command]
fn get_agent_status() -> Result<bool, String> {
    Ok(launchagent::is_installed())
}

#[tauri::command]
fn install_agent(config: tauri::State<ConfigState>) -> Result<(), String> {
    let schedule = config.0.lock().unwrap().schedule.clone();
    let path = cli_path()?;
    launchagent::install(&path, &schedule).map_err(|e| e.to_string())
}

#[tauri::command]
fn uninstall_agent() -> Result<(), String> {
    launchagent::uninstall().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_next_run(
    config: tauri::State<ConfigState>,
    state: tauri::State<AppStateWrapper>,
) -> Result<Option<String>, String> {
    let c = config.0.lock().unwrap();
    // Re-read state from disk to pick up runs made by the CLI / LaunchAgent.
    let fresh = AppState::load().map_err(|e| e.to_string())?;
    let mut s = state.0.lock().unwrap();
    *s = fresh.clone();
    Ok(scheduler::next_run_time(&c, &fresh).map(|t| t.to_rfc3339()))
}

pub fn run() {
    let config = Config::load().unwrap_or_default();
    let app_state = AppState::load().unwrap_or_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(ConfigState(Mutex::new(config)))
        .manage(AppStateWrapper(Mutex::new(app_state)))
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            get_state,
            scan_projects,
            clean_now,
            dry_run_now,
            pick_directory,
            get_agent_status,
            install_agent,
            uninstall_agent,
            get_next_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
