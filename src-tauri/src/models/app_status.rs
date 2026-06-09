use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct AppStatus {
    pub database_initialized: bool,
    pub database_path: String,
    pub foreign_keys_enabled: bool,
    pub migration_version: i64,
    pub preset_tag_count: i64,
}
