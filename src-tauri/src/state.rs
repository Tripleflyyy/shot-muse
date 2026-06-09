use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;

use crate::db;
use crate::models::AppStatus;

pub struct AppState {
    database_path: PathBuf,
    connection: Mutex<Connection>,
    database_initialized: bool,
}

impl AppState {
    pub fn initialize(app_data_dir: impl AsRef<Path>) -> rusqlite::Result<Self> {
        let database_path = db::initialize_database(app_data_dir)?;
        let connection = db::connect(&database_path)?;

        Ok(Self {
            database_path,
            connection: Mutex::new(connection),
            database_initialized: true,
        })
    }

    pub fn status(&self) -> rusqlite::Result<AppStatus> {
        let connection = self.connection.lock().map_err(|_| {
            rusqlite::Error::InvalidParameterName("database connection lock poisoned".into())
        })?;

        let foreign_keys_enabled: i64 =
            connection.query_row("PRAGMA foreign_keys", [], |row| row.get(0))?;
        let migration_version: i64 =
            connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;
        let preset_tag_count: i64 =
            connection.query_row("SELECT COUNT(*) FROM tags WHERE is_preset = 1", [], |row| {
                row.get(0)
            })?;

        Ok(AppStatus {
            database_initialized: self.database_initialized,
            database_path: self.database_path.to_string_lossy().into_owned(),
            foreign_keys_enabled: foreign_keys_enabled == 1,
            migration_version,
            preset_tag_count,
        })
    }

    pub fn database_path(&self) -> &Path {
        &self.database_path
    }
}
