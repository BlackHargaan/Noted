mod data;
mod storage;
use data::{Backup, Store, MAX_BYTES};
use std::{io::{Read, Write}, sync::Mutex};
use storage::{Database, Loaded, Recovery};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

struct Workspace(Mutex<Database>);
#[tauri::command]
fn load_workspace(db: State<Workspace>) -> Result<Loaded, String> { db.0.lock().map_err(|e| e.to_string())?.load() }
#[tauri::command]
fn save_workspace(db: State<Workspace>, store: Store, revision: i64) -> Result<i64, String> { db.0.lock().map_err(|e| e.to_string())?.save(store, revision) }
#[tauri::command]
fn list_recoveries(db: State<Workspace>) -> Result<Vec<Recovery>, String> { db.0.lock().map_err(|e| e.to_string())?.recoveries() }
#[tauri::command]
fn read_recovery(db: State<Workspace>, revision: i64) -> Result<Store, String> { db.0.lock().map_err(|e| e.to_string())?.recovery(revision) }

// File paths come from a native user selection, never from a renderer-supplied path.
#[tauri::command]
async fn export_backup(app: tauri::AppHandle, store: Store) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        store.validate()?;
        let Some(file) = app.dialog().file().add_filter("Noted backup", &["json"]).set_file_name("Noted-backup.json").blocking_save_file() else { return Ok(false); };
        let path = file.into_path().map_err(|e| e.to_string())?;
        let backup = Backup { format: "noted-backup".into(), version: 1, exported_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs().to_string(), workspace: store };
        let text = serde_json::to_vec(&backup).map_err(|e| e.to_string())?;
        if text.len() > MAX_BYTES { return Err("Backup exceeds 25 MB.".into()); }
        // Write beside the destination and atomically replace it only after a successful sync.
        let mut file = tempfile::NamedTempFile::new_in(path.parent().ok_or("Invalid backup destination.")?).map_err(|e| e.to_string())?;
        file.write_all(&text).and_then(|_| file.as_file().sync_all()).map_err(|e| e.to_string())?;
        file.persist(path).map_err(|e| e.to_string())?;
        Ok(true)
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
async fn import_backup(app: tauri::AppHandle) -> Result<Option<Store>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(file) = app.dialog().file().add_filter("Noted backup", &["json"]).blocking_pick_file() else { return Ok(None); };
        let path = file.into_path().map_err(|e| e.to_string())?;
        let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
        let mut text = String::new();
        file.take((MAX_BYTES + 1) as u64).read_to_string(&mut text).map_err(|e| e.to_string())?;
        data::parse_backup(&text).map(Some)
    }).await.map_err(|e| e.to_string())?
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.set_focus(); }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?; std::fs::create_dir_all(&dir)?;
            let db = Database::open(&dir.join("noted.sqlite3")).map_err(std::io::Error::other)?;
            app.manage(Workspace(Mutex::new(db))); Ok(())
        })
        .invoke_handler(tauri::generate_handler![load_workspace, save_workspace, list_recoveries, read_recovery, export_backup, import_backup])
        .run(tauri::generate_context!())
        .expect("Noted could not start. Your workspace database has not been replaced.");
}
