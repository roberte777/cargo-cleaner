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
        let last = last_run.with_timezone(&Local);
        let now = Local::now();

        let not_due = match config.schedule.frequency {
            Frequency::Daily => {
                // Already ran today — skip regardless of what time the schedule is set to
                last.date_naive() == now.date_naive()
            }
            Frequency::Weekly => {
                // Only blocks if the last run was on the scheduled weekday within the
                // last 7 days. A manual run on any other weekday does not count.
                let target_weekday = config.schedule.day_of_week.unwrap_or(0);
                let last_weekday = last.weekday().num_days_from_sunday();
                last_weekday == target_weekday
                    && (now.date_naive() - last.date_naive()).num_days() < 7
            }
            Frequency::Monthly => {
                // Only blocks if the last run was on the scheduled day of this month.
                // Running on any other day of the month does not count.
                let target_day = config.schedule.day_of_month.unwrap_or(1).max(1).min(28);
                last.day() == target_day
                    && last.month() == now.month()
                    && last.year() == now.year()
            }
        };

        if not_due {
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

pub fn next_run_time(config: &Config, state: &AppState) -> Option<chrono::DateTime<Utc>> {
    let now = Local::now();
    let hour = config.schedule.hour;
    let minute = config.schedule.minute;
    let time_passed = now.hour() > hour || (now.hour() == hour && now.minute() >= minute);

    let mut next = next_date(config, &now, time_passed)?;

    // If the last run was on the same calendar date as the computed next occurrence,
    // that occurrence is already fulfilled — advance by one more period.
    if let Some(last_run) = state.last_run {
        if last_run.with_timezone(&Local).date_naive() == next {
            next = advance_one_period(config, next)?;
        }
    }

    to_utc(next, hour, minute)
}

fn next_date(
    config: &Config,
    now: &chrono::DateTime<Local>,
    time_passed: bool,
) -> Option<NaiveDate> {
    match config.schedule.frequency {
        Frequency::Daily => {
            let mut next = now.date_naive();
            if time_passed {
                next = next.succ_opt()?;
            }
            Some(next)
        }
        Frequency::Weekly => {
            let target_weekday = config.schedule.day_of_week.unwrap_or(0);
            let current_weekday = now.weekday().num_days_from_sunday();
            let mut days_ahead = (target_weekday as i64 - current_weekday as i64).rem_euclid(7);
            if days_ahead == 0 && time_passed {
                days_ahead = 7;
            }
            Some(now.date_naive() + chrono::Duration::days(days_ahead))
        }
        Frequency::Monthly => {
            let target_day = config.schedule.day_of_month.unwrap_or(1).max(1).min(28);
            let today = now.date_naive();
            if today.day() < target_day || (today.day() == target_day && !time_passed) {
                NaiveDate::from_ymd_opt(today.year(), today.month(), target_day)
            } else {
                let (y, m) = if today.month() == 12 {
                    (today.year() + 1, 1)
                } else {
                    (today.year(), today.month() + 1)
                };
                NaiveDate::from_ymd_opt(y, m, target_day)
            }
        }
    }
}

fn advance_one_period(config: &Config, date: NaiveDate) -> Option<NaiveDate> {
    match config.schedule.frequency {
        Frequency::Daily => date.succ_opt(),
        Frequency::Weekly => Some(date + chrono::Duration::days(7)),
        Frequency::Monthly => {
            let target_day = config.schedule.day_of_month.unwrap_or(1).max(1).min(28);
            let (y, m) = if date.month() == 12 {
                (date.year() + 1, 1)
            } else {
                (date.year(), date.month() + 1)
            };
            NaiveDate::from_ymd_opt(y, m, target_day)
        }
    }
}

fn to_utc(date: NaiveDate, hour: u32, minute: u32) -> Option<chrono::DateTime<Utc>> {
    date.and_hms_opt(hour, minute, 0)
        .and_then(|naive| Local.from_local_datetime(&naive).single())
        .map(|dt| dt.with_timezone(&Utc))
}
