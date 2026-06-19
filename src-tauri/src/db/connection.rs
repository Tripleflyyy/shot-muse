use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::db::migrations;

pub const DATABASE_FILE_NAME: &str = "shot_muse.sqlite";

pub fn connect(database_path: impl AsRef<Path>) -> rusqlite::Result<Connection> {
    let connection = Connection::open(database_path)?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    Ok(connection)
}

pub fn initialize_database(app_data_dir: impl AsRef<Path>) -> rusqlite::Result<PathBuf> {
    let database_dir = app_data_dir.as_ref().join("database");
    fs::create_dir_all(&database_dir)
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;

    let database_path = database_dir.join(DATABASE_FILE_NAME);
    let connection = connect(&database_path)?;
    migrations::run_migrations(&connection)?;
    migrations::seed_default_tags(&connection)?;

    Ok(database_path)
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use crate::repositories::tag_repository;

    #[test]
    fn initialize_database_creates_p0_schema_and_preset_tags() {
        let temp_dir = std::env::temp_dir().join(format!(
            "shot-muse-db-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock before unix epoch")
                .as_nanos()
        ));

        let database_path = initialize_database(&temp_dir).expect("database initializes");
        assert!(database_path.exists());

        let connection = connect(&database_path).expect("database connects");
        let foreign_keys_enabled: i64 = connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .expect("foreign_keys pragma can be read");
        assert_eq!(foreign_keys_enabled, 1);

        for table_name in [
            "projects",
            "inspiration_cards",
            "tags",
            "inspiration_card_tags",
            "shooting_plans",
            "shooting_plan_inspirations",
            "media_assets",
        ] {
            let exists: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    [table_name],
                    |row| row.get(0),
                )
                .expect("table lookup succeeds");
            assert_eq!(exists, 1, "{table_name} should exist");
        }

        let preset_tag_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM tags WHERE is_preset = 1", [], |row| {
                row.get(0)
            })
            .expect("preset tag count can be read");
        assert_eq!(
            preset_tag_count as usize,
            tag_repository::preset_tag_count()
        );

        let inspiration_columns = connection
            .prepare("PRAGMA table_info(inspiration_cards)")
            .expect("prepare inspiration table info")
            .query_map([], |row| row.get::<_, String>(1))
            .expect("read inspiration table info")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("collect inspiration columns");
        assert!(
            inspiration_columns.iter().any(|column| column == "card_type"),
            "inspiration_cards should include card_type"
        );
        assert!(
            inspiration_columns
                .iter()
                .any(|column| column == "cover_media_asset_id"),
            "inspiration_cards should include cover_media_asset_id"
        );

        let project_columns = connection
            .prepare("PRAGMA table_info(projects)")
            .expect("prepare projects table info")
            .query_map([], |row| row.get::<_, String>(1))
            .expect("read projects table info")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("collect projects columns");
        assert!(
            project_columns.iter().any(|column| column == "sort_order"),
            "projects should include sort_order"
        );

        let shooting_plan_columns = connection
            .prepare("PRAGMA table_info(shooting_plans)")
            .expect("prepare shooting plans table info")
            .query_map([], |row| row.get::<_, String>(1))
            .expect("read shooting plans table info")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("collect shooting plans columns");
        assert!(
            shooting_plan_columns
                .iter()
                .any(|column| column == "sort_order"),
            "shooting_plans should include sort_order"
        );

        let media_columns = connection
            .prepare("PRAGMA table_info(media_assets)")
            .expect("prepare media table info")
            .query_map([], |row| row.get::<_, String>(1))
            .expect("read media table info")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("collect media columns");
        assert!(
            media_columns.iter().any(|column| column == "sort_order"),
            "media_assets should include sort_order"
        );

        fs::remove_dir_all(temp_dir).expect("temporary database directory is removed");
    }
}
