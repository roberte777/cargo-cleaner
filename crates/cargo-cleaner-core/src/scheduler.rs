use chrono::{Local, NaiveDate, TimeZone, Timelike, Utc};

use crate::config::{Config, PermissionMode, TimeWindow};
use crate::state::AppState;

#[derive(Debug, Clone, PartialEq)]
pub enum CleanDecision {
    NotDue,
    Proceed,
    AskUser,
}

pub fn should_clean(config: &Config, state: &AppState) -> CleanDecision {
    if let Some(last_run) = state.last_run {
        // Compare calendar dates in local time so "daily" means once per
        // calendar day regardless of the exact time the last run happened.
        let last_run_date = last_run.with_timezone(&Local).date_naive();
        let today = Local::now().date_naive();
        let days_since = (today - last_run_date).num_days();
        if days_since < config.schedule.interval_days as i64 {
            return CleanDecision::NotDue;
        }
    }

    match config.permission_mode {
        PermissionMode::NeverAsk => CleanDecision::Proceed,
        PermissionMode::AlwaysAsk => CleanDecision::AskUser,
        PermissionMode::DontAskWindows => {
            let current_hour = Local::now().hour();
            if is_within_windows(current_hour, &config.dont_ask_windows) {
                CleanDecision::Proceed
            } else {
                CleanDecision::AskUser
            }
        }
    }
}

fn is_within_windows(hour: u32, windows: &[TimeWindow]) -> bool {
    for w in windows {
        if w.start <= w.end {
            if hour >= w.start && hour < w.end {
                return true;
            }
        } else {
            // Overnight wrap: e.g. 22-6
            if hour >= w.start || hour < w.end {
                return true;
            }
        }
    }
    false
}

pub fn next_run_time(config: &Config, state: &AppState) -> Option<chrono::DateTime<Utc>> {
    state.last_run.map(|last| {
        let last_date = last.with_timezone(&Local).date_naive();
        let next_date: NaiveDate =
            last_date + chrono::Duration::days(config.schedule.interval_days as i64);
        let (hour, minute) = crate::launchagent::parse_time(&config.schedule.preferred_time);

        // Build a local datetime at preferred_time on next_date.
        next_date
            .and_hms_opt(hour, minute, 0)
            .and_then(|naive| Local.from_local_datetime(&naive).single())
            .map(|dt| dt.with_timezone(&Utc))
            // Fallback: if the local time is ambiguous (DST gap), add raw duration.
            .unwrap_or_else(|| last + chrono::Duration::days(config.schedule.interval_days as i64))
    })
}
