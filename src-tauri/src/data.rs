use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

pub const MAX_BYTES: usize = 25 * 1024 * 1024;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delete_batch: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub done: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delete_batch: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delete_batch: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Store {
    pub notes: Vec<Note>,
    pub tasks: Vec<Task>,
    #[serde(default)]
    pub projects: Vec<Project>,
}

fn ids<'a>(items: impl Iterator<Item = &'a str>) -> Result<HashSet<&'a str>, String> {
    let mut seen = HashSet::new();
    for id in items {
        if id.is_empty() || id.len() > 200 || !seen.insert(id) {
            return Err("Empty, duplicate, or oversized item ID.".into());
        }
    }
    Ok(seen)
}
fn tree(parents: HashMap<&str, Option<&str>>) -> Result<(), String> {
    for id in parents.keys() {
        let mut seen = HashSet::new();
        let mut current = Some(*id);
        while let Some(key) = current {
            if seen.len() >= 64 || !seen.insert(key) {
                return Err("A page or subtask has a circular parent.".into());
            }
            current = *parents.get(key).ok_or("An item has a missing parent.")?;
        }
    }
    Ok(())
}
fn date(value: &str) -> bool {
    let parts: Vec<_> = value.split('-').collect();
    if parts.len() != 3 || parts[0].len() != 4 || parts[1].len() != 2 || parts[2].len() != 2 || !parts.iter().all(|part| part.bytes().all(|b| b.is_ascii_digit())) { return false; }
    let (Ok(y), Ok(m), Ok(d)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>(), parts[2].parse::<u32>()) else { return false; };
    let leap = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
    let days = match m { 2 if leap => 29, 2 => 28, 4 | 6 | 9 | 11 => 30, 1 | 3 | 5 | 7 | 8 | 10 | 12 => 31, _ => 0 };
    y > 0 && d > 0 && d <= days
}
impl Store {
    pub fn validate(&self) -> Result<(), String> {
        if self.notes.len() + self.tasks.len() + self.projects.len() > 50_000 { return Err("Workspace exceeds the supported item limit.".into()); }
        let notes = ids(self.notes.iter().map(|n| n.id.as_str()))?;
        let tasks = ids(self.tasks.iter().map(|t| t.id.as_str()))?;
        let projects = ids(self.projects.iter().map(|p| p.id.as_str()))?;
        tree(self.notes.iter().map(|n| (n.id.as_str(), n.parent_id.as_deref())).collect())?;
        tree(self.tasks.iter().map(|t| (t.id.as_str(), t.parent_id.as_deref())).collect())?;
        for task in &self.tasks {
            if task.note_id.as_deref().is_some_and(|id| !notes.contains(id)) ||
               task.project_id.as_deref().is_some_and(|id| !projects.contains(id)) { return Err("A task references a missing note or project.".into()); }
            if task.priority.as_deref().is_some_and(|p| !["low", "medium", "high"].contains(&p)) { return Err("Invalid task priority.".into()); }
            if task.due.as_deref().is_some_and(|d| !date(d)) { return Err("Invalid task deadline.".into()); }
        }
        let _ = tasks;
        if serde_json::to_vec(self).map_err(|e| e.to_string())?.len() > MAX_BYTES { return Err("Workspace exceeds 25 MB.".into()); }
        Ok(())
    }
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Backup {
    pub format: String,
    pub version: u32,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    pub workspace: Store,
}
pub fn parse_backup(text: &str) -> Result<Store, String> {
    if text.len() > MAX_BYTES { return Err("Backup exceeds 25 MB.".into()); }
    let value: serde_json::Value = serde_json::from_str(text).map_err(|_| "Not a valid JSON backup.")?;
    let store = if value.get("format").is_some() {
        let b: Backup = serde_json::from_value(value).map_err(|e| e.to_string())?;
        if b.format != "noted-backup" || b.version != 1 { return Err("Unsupported backup format or version.".into()); }
        b.workspace
    } else { serde_json::from_value(value).map_err(|e| e.to_string())? };
    store.validate()?;
    Ok(store)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn legacy_backup_and_versioned_backup_round_trip() {
        let legacy = r#"{"notes":[{"id":"n","title":"Note","body":"Plain text"}],"tasks":[{"id":"t","title":"Task","done":false,"noteId":"n"}]}"#;
        let s = parse_backup(legacy).unwrap();
        let backup = Backup { format: "noted-backup".into(), version: 1, exported_at: "0".into(), workspace: s };
        let restored = parse_backup(&serde_json::to_string(&backup).unwrap()).unwrap();
        assert_eq!(restored.notes[0].body, "Plain text");
        assert_eq!(restored.tasks[0].note_id.as_deref(), Some("n"));
    }
    #[test]
    fn rejects_cycles_missing_links_and_duplicate_ids() {
        for text in [
            r#"{"notes":[{"id":"n","title":"","body":"","parentId":"n"}],"tasks":[]}"#,
            r#"{"notes":[],"tasks":[{"id":"t","title":"","done":false,"noteId":"missing"}]}"#,
            r#"{"notes":[],"tasks":[{"id":"t","title":"","done":false},{"id":"t","title":"","done":false}]}"#,
        ] { assert!(parse_backup(text).is_err()); }
    }
    #[test]
    fn validates_calendar_dates_and_backup_versions() {
        assert!(date("2024-02-29")); assert!(!date("2025-02-29")); assert!(!date("+001-01-01")); assert!(!date("2026-13-01"));
        assert!(parse_backup(r#"{"format":"noted-backup","version":99,"exportedAt":"0","workspace":{"notes":[],"tasks":[]}}"#).is_err());
    }
}
