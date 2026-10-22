use crate::data::Store;
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::Serialize;
use std::{path::Path, time::{SystemTime, UNIX_EPOCH}};

pub struct Database { conn: Connection }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Loaded { pub store: Option<Store>, pub revision: i64 }
#[derive(Serialize)]
pub struct Recovery { pub revision: i64, pub created: String }
impl Database {
    pub fn open(path: &Path) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        conn.busy_timeout(std::time::Duration::from_secs(5)).map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;").map_err(|e| e.to_string())?;
        let version: u32 = conn.pragma_query_value(None, "user_version", |r| r.get(0)).map_err(|e| e.to_string())?;
        if version > 1 { return Err("This workspace was created by a newer Noted version. Upgrade Noted to open it.".into()); }
        if version == 0 {
            conn.execute_batch("BEGIN IMMEDIATE;
                CREATE TABLE workspace (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, revision INTEGER NOT NULL);
                CREATE TABLE recovery (revision INTEGER PRIMARY KEY, payload TEXT NOT NULL, created TEXT NOT NULL);
                PRAGMA user_version=1;
                COMMIT;").map_err(|e| e.to_string())?;
        }
        Ok(Self { conn })
    }
    pub fn load(&self) -> Result<Loaded, String> {
        let row: Option<(String, i64)> = self.conn.query_row("SELECT payload,revision FROM workspace WHERE id=1", [], |r| Ok((r.get(0)?, r.get(1)?))).optional().map_err(|e| e.to_string())?;
        match row {
            None => Ok(Loaded { store: None, revision: 0 }),
            Some((payload, revision)) => {
                let store: Store = serde_json::from_str(&payload).map_err(|e| format!("Workspace could not be read: {e}"))?;
                store.validate()?;
                Ok(Loaded { store: Some(store), revision })
            }
        }
    }
    pub fn save(&mut self, store: Store, expected: i64) -> Result<i64, String> {
        store.validate()?;
        let payload = serde_json::to_string(&store).map_err(|e| e.to_string())?;
        let tx = self.conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|e| e.to_string())?;
        let row: Option<(String, i64)> = tx.query_row("SELECT payload,revision FROM workspace WHERE id=1", [], |r| Ok((r.get(0)?, r.get(1)?))).optional().map_err(|e| e.to_string())?;
        let revision = row.as_ref().map_or(0, |(_, revision)| *revision);
        if revision != expected { return Err("Workspace changed in another window. Export your unsaved work, then reopen Noted.".into()); }
        if let Some((previous, previous_revision)) = row {
            let now = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs().to_string();
            tx.execute("INSERT OR IGNORE INTO recovery(revision,payload,created) VALUES (?1,?2,?3)", params![previous_revision, previous, now]).map_err(|e| e.to_string())?;
        }
        let next = revision + 1;
        tx.execute("INSERT INTO workspace(id,payload,revision) VALUES(1,?1,?2) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision", params![payload, next]).map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM recovery WHERE revision NOT IN (SELECT revision FROM recovery ORDER BY revision DESC LIMIT 30)", []).map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(next)
    }
    pub fn recoveries(&self) -> Result<Vec<Recovery>, String> {
        let mut stmt = self.conn.prepare("SELECT revision,created FROM recovery ORDER BY revision DESC").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |r| Ok(Recovery { revision: r.get(0)?, created: r.get(1)? })).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
    pub fn recovery(&self, revision: i64) -> Result<Store, String> {
        let payload: String = self.conn.query_row("SELECT payload FROM recovery WHERE revision=?1", [revision], |r| r.get(0)).map_err(|e| e.to_string())?;
        let store: Store = serde_json::from_str(&payload).map_err(|e| e.to_string())?;
        store.validate()?;
        Ok(store)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sample() -> Store { serde_json::from_str(r#"{"notes":[{"id":"n","title":"A","body":"Keep me"}],"tasks":[],"projects":[]}"#).unwrap() }
    #[test]
    fn persists_and_upgrades_without_losing_content() {
        let dir = tempfile::tempdir().unwrap(); let path = dir.path().join("test.db");
        { let mut db = Database::open(&path).unwrap(); assert_eq!(db.load().unwrap().revision, 0); assert_eq!(db.save(sample(), 0).unwrap(), 1); }
        let db = Database::open(&path).unwrap();
        assert_eq!(db.load().unwrap().store.unwrap().notes[0].body, "Keep me");
        assert_eq!(db.load().unwrap().revision, 1);
    }
    #[test]
    fn rejects_conflicting_saves_without_overwriting() {
        let dir = tempfile::tempdir().unwrap(); let mut db = Database::open(&dir.path().join("test.db")).unwrap();
        db.save(sample(), 0).unwrap();
        assert!(db.save(sample(), 0).is_err());
        assert_eq!(db.load().unwrap().revision, 1);
    }
    #[test]
    fn restores_previous_snapshot_and_keeps_the_replaced_one() {
        let dir = tempfile::tempdir().unwrap(); let mut db = Database::open(&dir.path().join("test.db")).unwrap();
        db.save(sample(), 0).unwrap();
        let mut changed = sample(); changed.notes[0].body = "Changed".into(); db.save(changed, 1).unwrap();
        let old = db.recovery(1).unwrap(); db.save(old, 2).unwrap();
        assert_eq!(db.load().unwrap().store.unwrap().notes[0].body, "Keep me");
        assert_eq!(db.recovery(2).unwrap().notes[0].body, "Changed");
    }
    #[test]
    fn refuses_future_database_versions() {
        let dir = tempfile::tempdir().unwrap(); let path = dir.path().join("test.db");
        Connection::open(&path).unwrap().pragma_update(None, "user_version", 999).unwrap();
        assert!(Database::open(&path).is_err());
    }
    #[test]
    fn invalid_data_never_replaces_saved_data() {
        let dir = tempfile::tempdir().unwrap(); let mut db = Database::open(&dir.path().join("test.db")).unwrap();
        db.save(sample(), 0).unwrap(); let mut bad = sample(); bad.notes[0].parent_id = Some("n".into());
        assert!(db.save(bad, 1).is_err()); assert_eq!(db.load().unwrap().revision, 1);
    }
    #[test]
    fn retains_thirty_previous_revisions() {
        let dir = tempfile::tempdir().unwrap(); let mut db = Database::open(&dir.path().join("test.db")).unwrap();
        for revision in 0..35 { db.save(sample(), revision).unwrap(); }
        let revisions = db.recoveries().unwrap();
        assert_eq!(revisions.len(), 30); assert_eq!(revisions[0].revision, 34); assert_eq!(revisions[29].revision, 5);
    }
}
