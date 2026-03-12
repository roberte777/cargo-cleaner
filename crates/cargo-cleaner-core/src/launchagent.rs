use anyhow::Result;
use std::path::PathBuf;

const PLIST_LABEL: &str = "com.cargo-cleaner.agent";

pub fn plist_path() -> Result<PathBuf> {
    let home =
        dirs::home_dir().ok_or_else(|| anyhow::anyhow!("Cannot determine home directory"))?;
    Ok(home
        .join("Library/LaunchAgents")
        .join(format!("{}.plist", PLIST_LABEL)))
}

/// Parse "HH:MM" into (hour, minute), defaulting to 02:00 on malformed input.
pub fn parse_time(preferred_time: &str) -> (u32, u32) {
    let mut parts = preferred_time.splitn(2, ':');
    let hour = parts.next().and_then(|s| s.parse().ok()).unwrap_or(2);
    let minute = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    (hour.min(23), minute.min(59))
}

pub fn generate_plist(cli_binary_path: &str, hour: u32, minute: u32) -> String {
    let home = dirs::home_dir()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_default();
    let cargo_bin_dir = format!("{home}/.cargo/bin");

    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{binary}</string>
        <string>run</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>{cargo_bin}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>{hour}</integer>
        <key>Minute</key>
        <integer>{minute}</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/cargo-cleaner.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/cargo-cleaner.err</string>
</dict>
</plist>"#,
        label = PLIST_LABEL,
        binary = cli_binary_path,
        cargo_bin = cargo_bin_dir,
        hour = hour,
        minute = minute,
    )
}

pub fn install(cli_binary_path: &str, hour: u32, minute: u32) -> Result<()> {
    let path = plist_path()?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Unload any existing version before writing the updated plist
    if path.exists() {
        std::process::Command::new("launchctl")
            .args(["unload", &path.to_string_lossy()])
            .output()?;
    }

    let content = generate_plist(cli_binary_path, hour, minute);
    std::fs::write(&path, content)?;

    std::process::Command::new("launchctl")
        .args(["load", &path.to_string_lossy()])
        .output()?;

    // Write a standalone uninstall script to the config dir so the user can
    // remove the LaunchAgent even if the app has already been deleted.
    write_uninstall_script()?;

    Ok(())
}

fn write_uninstall_script() -> Result<()> {
    let config_dir = crate::config::Config::config_dir()?;
    let script_path = config_dir.join("uninstall.sh");
    let plist = plist_path()?;

    let script = format!(
        r#"#!/bin/bash
# Cargo Cleaner – uninstall script
# Run this to remove the LaunchAgent even if the app has already been deleted:
#   bash "{script}"

PLIST="{plist}"

if [ -f "$PLIST" ]; then
    launchctl unload "$PLIST" 2>/dev/null
    rm "$PLIST"
    echo "✓ LaunchAgent removed."
else
    echo "LaunchAgent not found (already removed)."
fi

echo ""
echo "To also delete config and state:"
echo "  rm -rf \"{config_dir}\""
"#,
        script = script_path.to_string_lossy(),
        plist = plist.to_string_lossy(),
        config_dir = config_dir.to_string_lossy(),
    );

    std::fs::write(&script_path, &script)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&script_path, std::fs::Permissions::from_mode(0o755))?;
    }

    Ok(())
}

pub fn uninstall() -> Result<()> {
    let path = plist_path()?;
    if path.exists() {
        std::process::Command::new("launchctl")
            .args(["unload", &path.to_string_lossy()])
            .output()?;
        std::fs::remove_file(&path)?;
    }
    Ok(())
}

pub fn is_installed() -> bool {
    plist_path().map(|p| p.exists()).unwrap_or(false)
}
