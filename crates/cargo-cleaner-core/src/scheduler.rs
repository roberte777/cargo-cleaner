use chrono::{Datelike, Local, NaiveDate, TimeZone, Timelike, Utc};

use crate::config::{Config, Frequency, PermissionMode, TimeWindow};
use crate::state::AppState;

#[derive(Debug, Clone, PartialEq)]
pub enum CleanDecision {
    NotDue,
    Proceed,
    AskUser,
}

pub fn should_clean(config: &Config, state: &AppState) -> CleanDecision {
    if let Some(last_run) = state.last_run {
        let last_run_date = last_run.with_timezone(&Local).date_naive();
        let today = Local::now().date_naive();
        let days_since = (today - last_run_date).num_days();
        if days_since < config.schedule.interval_days() as i64 {
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
            if hour >= w.start || hour < w.end {
                return true;
            }
        }
    }
    false
}

pub fn next_run_time(config: &Config, _state: &AppState) -> Option<chrono::DateTime<Utc>> {
    let now = Local::now();
    let hour = config.schedule.hour;

    match config.schedule.frequency {
        Frequency::Daily => {
            let mut next = now.date_naive();
            if now.hour() >= hour {
                next = next.succ_opt().unwrap_or(next);
            }
            to_utc(next, hour)
        }
        Frequency::Weekly => {
            let target_weekday = config.schedule.day_of_week.unwrap_or(0);
            let current_weekday = now.weekday().num_days_from_sunday();
            let mut days_ahead = (target_weekday as i64 - current_weekday as i64).rem_euclid(7);
            if days_ahead == 0 && now.hour() >= hour {
                days_ahead = 7;
            }
            let next = now.date_naive() + chrono::Duration::days(days_ahead);
            to_utc(next, hour)
        }
        Frequency::Monthly => {
            let target_day = config.schedule.day_of_month.unwrap_or(1).max(1).min(28);
            let today = now.date_naive();
            let next = if today.day() < target_day
                || (today.day() == target_day && now.hour() < hour)
            {
                NaiveDate::from_ymd_opt(today.year(), today.month(), target_day)
            } else {
                let (y, m) = if today.month() == 12 {
                    (today.year() + 1, 1)
                } else {
                    (today.year(), today.month() + 1)
                };
                NaiveDate::from_ymd_opt(y, m, target_day)
            };
            next.and_then(|d| to_utc(d, hour))
        }
    }
}

fn to_utc(date: NaiveDate, hour: u32) -> Option<chrono::DateTime<Utc>> {
    date.and_hms_opt(hour, 0, 0)
        .and_then(|naive| Local.from_local_datetime(&naive).single())
        .map(|dt| dt.with_timezone(&Utc))
}
