use anyhow::Result;
use bytesize::ByteSize;
use clap::{Parser, Subcommand};

use cargo_cleaner_core::*;

#[derive(Parser)]
#[command(name = "cargo-cleaner")]
#[command(about = "Automatically clean Rust project target/ directories")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run cleanup logic (respects schedule and permission mode)
    Run {
        /// Force cleanup regardless of schedule
        #[arg(long)]
        force: bool,
    },
    /// Scan for Rust projects and show sizes
    Scan,
    /// Clean all discovered projects immediately
    Clean {
        /// Preview what would be cleaned without doing it
        #[arg(long)]
        dry_run: bool,
    },
    /// Show current status and statistics
    Status,
    /// Manage the LaunchAgent
    Agent {
        #[command(subcommand)]
        action: AgentAction,
    },
    /// Show config file path
    Config,
}

#[derive(Subcommand)]
enum AgentAction {
    /// Install the LaunchAgent for automatic scheduling
    Install,
    /// Uninstall the LaunchAgent
    Uninstall,
    /// Show LaunchAgent status
    Status,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Run { force } => cmd_run(force)?,
        Commands::Scan => cmd_scan()?,
        Commands::Clean { dry_run } => cmd_clean(dry_run)?,
        Commands::Status => cmd_status()?,
        Commands::Agent { action } => match action {
            AgentAction::Install => cmd_agent_install()?,
            AgentAction::Uninstall => cmd_agent_uninstall()?,
            AgentAction::Status => cmd_agent_status()?,
        },
        Commands::Config => cmd_config()?,
    }

    Ok(())
}

fn cmd_run(force: bool) -> Result<()> {
    let config = Config::load()?;
    let mut state = AppState::load()?;

    if !force {
        let decision = scheduler::should_clean(&config, &state);
        match decision {
            CleanDecision::NotDue => return Ok(()),
            CleanDecision::AskUser => {
                let projects =
                    scanner::scan_for_projects(&config.scan_paths, &config.exclude_patterns)?;
                let cleanable: Vec<_> = projects.iter().filter(|p| p.has_target).collect();

                if cleanable.is_empty() {
                    return Ok(());
                }

                let total_bytes: u64 = cleanable.iter().map(|p| p.target_size_bytes).sum();
                let size_display = ByteSize(total_bytes).to_string();

                if !macos::ask_user_permission(cleanable.len(), &size_display)? {
                    return Ok(());
                }

                let summary = cleaner::clean_projects(&projects, config.dry_run)?;
                if !config.dry_run {
                    let cleaned_paths: Vec<_> = summary
                        .results
                        .iter()
                        .filter(|r| r.success)
                        .map(|r| r.project.clone())
                        .collect();
                    state.record_cleanup(summary.total_freed_bytes, cleaned_paths);
                    state.save()?;
                    macos::send_notification(
                        "Cargo Cleaner",
                        &format!(
                            "Cleaned {} projects, freed {}",
                            summary.total_cleaned,
                            ByteSize(summary.total_freed_bytes)
                        ),
                    )?;
                }
            }
            CleanDecision::Proceed => {
                let projects =
                    scanner::scan_for_projects(&config.scan_paths, &config.exclude_patterns)?;
                let summary = cleaner::clean_projects(&projects, config.dry_run)?;
                if !config.dry_run {
                    let cleaned_paths: Vec<_> = summary
                        .results
                        .iter()
                        .filter(|r| r.success)
                        .map(|r| r.project.clone())
                        .collect();
                    state.record_cleanup(summary.total_freed_bytes, cleaned_paths);
                    state.save()?;
                    macos::send_notification(
                        "Cargo Cleaner",
                        &format!(
                            "Auto-cleaned {} projects, freed {}",
                            summary.total_cleaned,
                            ByteSize(summary.total_freed_bytes)
                        ),
                    )?;
                }
            }
        }
    } else {
        let projects =
            scanner::scan_for_projects(&config.scan_paths, &config.exclude_patterns)?;
        let summary = cleaner::clean_projects(&projects, config.dry_run)?;
        if !config.dry_run {
            let cleaned_paths: Vec<_> = summary
                .results
                .iter()
                .filter(|r| r.success)
                .map(|r| r.project.clone())
                .collect();
            state.record_cleanup(summary.total_freed_bytes, cleaned_paths);
            state.save()?;
        }
        println!(
            "{}Cleaned {} projects, freed {}",
            if config.dry_run { "[dry run] " } else { "" },
            summary.total_cleaned,
            ByteSize(summary.total_freed_bytes)
        );
    }

    Ok(())
}

fn cmd_scan() -> Result<()> {
    let config = Config::load()?;
    let projects = scanner::scan_for_projects(&config.scan_paths, &config.exclude_patterns)?;

    if projects.is_empty() {
        println!("No Rust projects found in configured scan paths.");
        return Ok(());
    }

    let total_bytes: u64 = projects.iter().map(|p| p.target_size_bytes).sum();
    let with_target = projects.iter().filter(|p| p.has_target).count();

    println!(
        "Found {} Rust projects ({} with target/ directories, {} total)",
        projects.len(),
        with_target,
        ByteSize(total_bytes)
    );
    println!();

    for project in &projects {
        if project.has_target {
            println!(
                "  {:>10}  {}",
                ByteSize(project.target_size_bytes),
                project.path.display()
            );
        }
    }

    Ok(())
}

fn cmd_clean(dry_run: bool) -> Result<()> {
    let config = Config::load()?;
    let mut state = AppState::load()?;
    let projects = scanner::scan_for_projects(&config.scan_paths, &config.exclude_patterns)?;

    let effective_dry_run = dry_run || config.dry_run;
    if effective_dry_run {
        println!("Dry run mode - no files will be deleted.\n");
    }

    let summary = cleaner::clean_projects(&projects, effective_dry_run)?;

    for result in &summary.results {
        let status = if result.success { "OK" } else { "FAIL" };
        println!(
            "  [{}] {:>10}  {}",
            status,
            ByteSize(result.freed_bytes),
            result.project.display()
        );
        if let Some(ref err) = result.error {
            println!("         Error: {}", err);
        }
    }

    println!(
        "\nTotal: cleaned {} projects, freed {} ({} failed)",
        summary.total_cleaned,
        ByteSize(summary.total_freed_bytes),
        summary.total_failed
    );

    if !effective_dry_run {
        let cleaned_paths: Vec<_> = summary
            .results
            .iter()
            .filter(|r| r.success)
            .map(|r| r.project.clone())
            .collect();
        state.record_cleanup(summary.total_freed_bytes, cleaned_paths);
        state.save()?;
    }

    Ok(())
}

fn cmd_status() -> Result<()> {
    let config = Config::load()?;
    let state = AppState::load()?;

    println!("Cargo Cleaner Status");
    println!("====================\n");

    println!("Scan paths:");
    if config.scan_paths.is_empty() {
        println!("  (none configured)");
    } else {
        for path in &config.scan_paths {
            println!("  - {}", path.display());
        }
    }

    println!("\nSchedule: every {} day(s) at {}", config.schedule.interval_days, config.schedule.preferred_time);
    println!("Permission mode: {:?}", config.permission_mode);
    println!("Dry run: {}", config.dry_run);

    println!("\nStatistics:");
    match state.last_run {
        Some(last) => println!("  Last run: {}", last.format("%Y-%m-%d %H:%M:%S UTC")),
        None => println!("  Last run: never"),
    }
    println!("  Total space freed: {:.1} GB", state.total_space_freed_gb());
    println!("  Total projects cleaned: {}", state.total_projects_cleaned);

    if let Some(next) = scheduler::next_run_time(&config, &state) {
        println!("  Next run: {}", next.format("%Y-%m-%d %H:%M:%S UTC"));
    }

    println!("\nLaunchAgent: {}", if launchagent::is_installed() { "installed" } else { "not installed" });

    Ok(())
}

fn cmd_agent_install() -> Result<()> {
    let config = Config::load()?;
    let (hour, minute) = launchagent::parse_time(&config.schedule.preferred_time);
    let binary_path = std::env::current_exe()?;
    let binary_str = binary_path.to_string_lossy();
    launchagent::install(&binary_str, hour, minute)?;
    println!("LaunchAgent installed successfully.");
    println!(
        "The cleaner will run daily at {:02}:{:02}.",
        hour, minute
    );
    Ok(())
}

fn cmd_agent_uninstall() -> Result<()> {
    launchagent::uninstall()?;
    println!("LaunchAgent uninstalled.");
    Ok(())
}

fn cmd_agent_status() -> Result<()> {
    if launchagent::is_installed() {
        println!("LaunchAgent is installed.");
        if let Ok(path) = launchagent::plist_path() {
            println!("Plist: {}", path.display());
        }
    } else {
        println!("LaunchAgent is not installed.");
    }
    Ok(())
}

fn cmd_config() -> Result<()> {
    let path = Config::config_path()?;
    println!("Config file: {}", path.display());
    if path.exists() {
        println!("\nCurrent config:");
        let contents = std::fs::read_to_string(&path)?;
        println!("{}", contents);
    } else {
        println!("Config file does not exist yet. Run any command to create it with defaults.");
    }
    Ok(())
}
