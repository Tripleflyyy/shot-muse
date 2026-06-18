use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{MediaAsset, MediaAssetFilters, MediaAssetPayload};

pub fn create_media_asset(
    connection: &Connection,
    payload: &MediaAssetPayload,
) -> rusqlite::Result<MediaAsset> {
    let id = Uuid::new_v4().to_string();
    let sort_order = next_sort_order(
        connection,
        payload.target_type.trim(),
        normalize_optional_text(&payload.target_id).as_deref(),
    )?;

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
          sort_order,
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
          ?11,
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
            sort_order,
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
              sort_order,
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
          sort_order,
          source_type,
          created_at,
          updated_at
        FROM media_assets
        ORDER BY target_type ASC, target_id ASC, sort_order ASC, created_at ASC
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
    connection.execute(
        "
        UPDATE inspiration_cards
        SET
          cover_media_asset_id = NULL,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE cover_media_asset_id = ?1
        ",
        [id],
    )?;

    let deleted_count = connection.execute("DELETE FROM media_assets WHERE id = ?1", [id])?;
    Ok(deleted_count > 0)
}

pub fn reorder_media_assets(
    connection: &Connection,
    target_type: &str,
    target_id: &str,
    ordered_media_asset_ids: &[String],
) -> rusqlite::Result<Vec<MediaAsset>> {
    for (index, media_asset_id) in ordered_media_asset_ids.iter().enumerate() {
        let updated_count = connection.execute(
            "
            UPDATE media_assets
            SET
              sort_order = ?4,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?1
              AND target_type = ?2
              AND target_id = ?3
            ",
            params![
                media_asset_id.trim(),
                target_type.trim(),
                target_id.trim(),
                index as i64,
            ],
        )?;

        if updated_count == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
    }

    list_media_assets_by_target(connection, target_type, target_id)
}

fn next_sort_order(
    connection: &Connection,
    target_type: &str,
    target_id: Option<&str>,
) -> rusqlite::Result<i64> {
    connection.query_row(
        "
        SELECT COALESCE(MAX(sort_order), -1) + 1
        FROM media_assets
        WHERE target_type = ?1
          AND (
            (target_id IS NULL AND ?2 IS NULL)
            OR target_id = ?2
          )
        ",
        params![target_type, target_id],
        |row| row.get(0),
    )
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
        sort_order: row.get(9)?,
        source_type: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
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
        assert_eq!(created.sort_order, 0);

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
    fn sort_order_reorder_and_cover_cleanup_work() {
        let connection = test_connection();
        connection
            .execute(
                "
                INSERT INTO inspiration_cards (
                  id,
                  card_type,
                  title,
                  source_platform,
                  collected_at,
                  created_at,
                  updated_at
                )
                VALUES (
                  'card-1',
                  'inspiration',
                  '测试卡片',
                  'xiaohongshu',
                  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                )
                ",
                [],
            )
            .expect("insert card");

        let first = create_media_asset(&connection, &payload()).expect("create first");
        let second = create_media_asset(&connection, &payload()).expect("create second");
        assert_eq!(first.sort_order, 0);
        assert_eq!(second.sort_order, 1);

        let reordered = reorder_media_assets(
            &connection,
            "inspiration",
            "inspiration-1",
            &[second.id.clone(), first.id.clone()],
        )
        .expect("reorder media assets");
        assert_eq!(reordered[0].id, second.id);
        assert_eq!(reordered[0].sort_order, 0);
        assert_eq!(reordered[1].id, first.id);
        assert_eq!(reordered[1].sort_order, 1);

        assert!(reorder_media_assets(
            &connection,
            "project",
            "other-target",
            &[second.id.clone()]
        )
        .is_err());

        connection
            .execute(
                "
                UPDATE inspiration_cards
                SET cover_media_asset_id = ?1
                WHERE id = 'card-1'
                ",
                [&second.id],
            )
            .expect("set card cover");
        assert!(delete_media_asset(&connection, &second.id).expect("delete cover media"));

        let cover_media_asset_id: Option<String> = connection
            .query_row(
                "SELECT cover_media_asset_id FROM inspiration_cards WHERE id = 'card-1'",
                [],
                |row| row.get(0),
            )
            .expect("read cleared cover");
        assert!(cover_media_asset_id.is_none());
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
