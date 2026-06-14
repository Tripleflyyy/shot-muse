use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{MediaAsset, MediaAssetFilters, MediaAssetPayload};

pub fn create_media_asset(
    connection: &Connection,
    payload: &MediaAssetPayload,
) -> rusqlite::Result<MediaAsset> {
    let id = Uuid::new_v4().to_string();

    connection.execute(
        "
        INSERT INTO media_assets (
          id,
          target_type,
          target_id,
          file_path,
          original_filename,
          mime_type,
          file_size,
          width,
          height,
          source_type,
          created_at,
          updated_at
        )
        VALUES (
          ?1,
          ?2,
          ?3,
          ?4,
          ?5,
          ?6,
          ?7,
          ?8,
          ?9,
          ?10,
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        )
        ",
        params![
            id,
            payload.target_type.trim(),
            normalize_optional_text(&payload.target_id),
            payload.file_path.trim(),
            normalize_optional_text(&payload.original_filename),
            normalize_optional_text(&payload.mime_type),
            payload.file_size,
            payload.width,
            payload.height,
            payload.source_type.trim(),
        ],
    )?;

    get_media_asset(connection, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn get_media_asset(connection: &Connection, id: &str) -> rusqlite::Result<Option<MediaAsset>> {
    connection
        .query_row(
            "
            SELECT
              id,
              target_type,
              target_id,
              file_path,
              original_filename,
              mime_type,
              file_size,
              width,
              height,
              source_type,
              created_at,
              updated_at
            FROM media_assets
            WHERE id = ?1
            ",
            [id],
            map_media_asset,
        )
        .optional()
}

pub fn list_media_assets(
    connection: &Connection,
    filters: &MediaAssetFilters,
) -> rusqlite::Result<Vec<MediaAsset>> {
    let mut statement = connection.prepare(
        "
        SELECT
          id,
          target_type,
          target_id,
          file_path,
          original_filename,
          mime_type,
          file_size,
          width,
          height,
          source_type,
          created_at,
          updated_at
        FROM media_assets
        ORDER BY created_at DESC
        ",
    )?;

    let rows = statement
        .query_map([], map_media_asset)?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let target_type = normalize_optional_text(&filters.target_type);
    let target_id = normalize_optional_text(&filters.target_id);
    let source_type = normalize_optional_text(&filters.source_type);

    Ok(rows
        .into_iter()
        .filter(|asset| {
            if let Some(target_type) = target_type.as_deref() {
                if asset.target_type != target_type {
                    return false;
                }
            }

            if let Some(target_id) = target_id.as_deref() {
                if asset.target_id.as_deref() != Some(target_id) {
                    return false;
                }
            }

            if let Some(source_type) = source_type.as_deref() {
                if asset.source_type != source_type {
                    return false;
                }
            }

            true
        })
        .collect())
}

pub fn list_media_assets_by_target(
    connection: &Connection,
    target_type: &str,
    target_id: &str,
) -> rusqlite::Result<Vec<MediaAsset>> {
    list_media_assets(
        connection,
        &MediaAssetFilters {
            target_type: Some(target_type.to_string()),
            target_id: Some(target_id.to_string()),
            source_type: None,
        },
    )
}

pub fn update_media_asset_target(
    connection: &Connection,
    id: &str,
    target_type: &str,
    target_id: Option<String>,
) -> rusqlite::Result<Option<MediaAsset>> {
    let updated_count = connection.execute(
        "
        UPDATE media_assets
        SET
          target_type = ?2,
          target_id = ?3,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1
        ",
        params![id, target_type.trim(), normalize_optional_text(&target_id)],
    )?;

    if updated_count == 0 {
        return Ok(None);
    }

    get_media_asset(connection, id)
}

pub fn delete_media_asset(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    let deleted_count = connection.execute("DELETE FROM media_assets WHERE id = ?1", [id])?;
    Ok(deleted_count > 0)
}

fn map_media_asset(row: &rusqlite::Row<'_>) -> rusqlite::Result<MediaAsset> {
    Ok(MediaAsset {
        id: row.get(0)?,
        target_type: row.get(1)?,
        target_id: row.get(2)?,
        file_path: row.get(3)?,
        original_filename: row.get(4)?,
        mime_type: row.get(5)?,
        file_size: row.get(6)?,
        width: row.get(7)?,
        height: row.get(8)?,
        source_type: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn normalize_optional_text(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::media_commands::{
        validate_media_asset_payload, validate_source_type, validate_target_type,
    };
    use crate::db::migrations;

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("open in-memory database");
        migrations::run_migrations(&connection).expect("run migrations");
        connection
    }

    fn payload() -> MediaAssetPayload {
        MediaAssetPayload {
            target_type: "inspiration".into(),
            target_id: Some("inspiration-1".into()),
            file_path: "/media/inspiration/test.jpg".into(),
            original_filename: Some("test.jpg".into()),
            mime_type: Some("image/jpeg".into()),
            file_size: Some(2048),
            width: Some(1200),
            height: Some(800),
            source_type: "file_picker".into(),
        }
    }

    #[test]
    fn create_get_list_update_and_delete_media_asset() {
        let connection = test_connection();
        let created =
            create_media_asset(&connection, &payload()).expect("create media asset record");

        assert!(!created.id.is_empty());
        assert_eq!(created.target_type, "inspiration");
        assert_eq!(created.target_id.as_deref(), Some("inspiration-1"));
        assert_eq!(created.file_path, "/media/inspiration/test.jpg");
        assert_eq!(created.source_type, "file_picker");

        let fetched = get_media_asset(&connection, &created.id)
            .expect("get media asset")
            .expect("media asset exists");
        assert_eq!(fetched.id, created.id);

        let by_target = list_media_assets_by_target(&connection, "inspiration", "inspiration-1")
            .expect("list by target");
        assert_eq!(by_target.len(), 1);
        assert_eq!(by_target[0].id, created.id);

        let filtered = list_media_assets(
            &connection,
            &MediaAssetFilters {
                target_type: Some("inspiration".into()),
                target_id: Some("inspiration-1".into()),
                source_type: Some("file_picker".into()),
            },
        )
        .expect("list filtered media assets");
        assert_eq!(filtered.len(), 1);

        let updated = update_media_asset_target(
            &connection,
            &created.id,
            "project",
            Some("project-1".into()),
        )
        .expect("update media target")
        .expect("updated media asset exists");
        assert_eq!(updated.target_type, "project");
        assert_eq!(updated.target_id.as_deref(), Some("project-1"));

        assert!(delete_media_asset(&connection, &created.id).expect("delete media asset"));
        assert!(get_media_asset(&connection, &created.id)
            .expect("get after delete")
            .is_none());
    }

    #[test]
    fn validation_rejects_invalid_media_asset_values() {
        let mut invalid_target = payload();
        invalid_target.target_type = "avatar".into();
        assert!(validate_target_type(&invalid_target.target_type).is_err());

        let mut invalid_source = payload();
        invalid_source.source_type = "download".into();
        assert!(validate_source_type(&invalid_source.source_type).is_err());

        let mut empty_path = payload();
        empty_path.file_path = " ".into();
        assert!(validate_media_asset_payload(&empty_path).is_err());
    }
}
