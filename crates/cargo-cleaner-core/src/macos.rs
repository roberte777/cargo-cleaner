use anyhow::Result;
use std::process::Command;

pub fn ask_user_permission(projects_count: usize, total_size_display: &str) -> Result<bool> {
    let script = format!(
        r#"display dialog "Cargo Cleaner found {} Rust project(s) with {} of target/ data.

Clean now?" buttons {{"Cancel", "Clean"}} default button "Clean" with title "Cargo Cleaner""#,
        projects_count, total_size_display
    );

    match Command::new("osascript").args(["-e", &script]).output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => {
            // Dialog unavailable (no GUI session) — notify the user instead.
            let _ = send_notification(
                "Cargo Cleaner",
                &format!(
                    "{} project(s) ready to clean ({}) — open the app to clean now.",
                    projects_count, total_size_display
                ),
            );
            Ok(false)
        }
    }
}

pub fn send_notification(title: &str, message: &str) -> Result<()> {
    let script = format!(
        r#"display notification "{}" with title "{}""#,
        message.replace('"', "\\\""),
        title.replace('"', "\\\""),
    );

    Command::new("osascript").args(["-e", &script]).output()?;

    Ok(())
}
