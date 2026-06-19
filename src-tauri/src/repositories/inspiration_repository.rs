use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{InspirationCard, InspirationCardFilters, InspirationCardPayload, Tag};

#[derive(Debug, Clone)]
struct InspirationCardRow {
    id: String,
    card_type: String,
    title: String,
    source_platform: String,
    source_url: Option<String>,
    author_name: Option<String>,
    notes: Option<String>,
    project_id: Option<String>,
    project_name: Option<String>,
    cover_media_asset_id: Option<String>,
    collected_at: String,
    created_at: String,
    updated_at: String,
}

pub fn create_inspiration_card(
    connection: &Connection,
    payload: &InspirationCardPayload,
) -> rusqlite::Result<InspirationCard> {
    let id = Uuid::new_v4().to_string();
    let collected_at = normalize_optional_text(&payload.collected_at);

    connection.execute(
        "
        INSERT INTO inspiration_cards (
          id,
          card_type,
          title,
          source_platform,
          source_url,
          author_name,
          notes,
          project_id,
          collected_at,
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
          COALESCE(?9, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        )
        ",
        params![
            id,
            normalized_card_type(payload.card_type.as_deref()),
            payload.title.trim(),
            payload.source_platform.trim(),
            normalize_optional_text(&payload.source_url),
            normalize_optional_text(&payload.author_name),
            normalize_optional_text(&payload.notes),
            normalize_optional_text(&payload.project_id),
            collected_at,
        ],
    )?;

    replace_inspiration_tags(connection, &id, payload.tag_ids.as_deref().unwrap_or(&[]))?;
    get_inspiration_card(connection, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn update_inspiration_card(
    connection: &Connection,
    id: &str,
    payload: &InspirationCardPayload,
) -> rusqlite::Result<Option<InspirationCard>> {
    let updated_count = connection.execute(
        "
        UPDATE inspiration_cards
        SET
          card_type = ?2,
          title = ?3,
          source_platform = ?4,
          source_url = ?5,
          author_name = ?6,
          notes = ?7,
          project_id = ?8,
          collected_at = COALESCE(?9, collected_at),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1
        ",
        params![
            id,
            normalized_card_type(payload.card_type.as_deref()),
            payload.title.trim(),
            payload.source_platform.trim(),
            normalize_optional_text(&payload.source_url),
            normalize_optional_text(&payload.author_name),
            normalize_optional_text(&payload.notes),
            normalize_optional_text(&payload.project_id),
            normalize_optional_text(&payload.collected_at),
        ],
    )?;

    if updated_count == 0 {
        return Ok(None);
    }

    replace_inspiration_tags(connection, id, payload.tag_ids.as_deref().unwrap_or(&[]))?;
    get_inspiration_card(connection, id)
}

pub fn delete_inspiration_card(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    let deleted_count = connection.execute("DELETE FROM inspiration_cards WHERE id = ?1", [id])?;
    Ok(deleted_count > 0)
}

pub fn get_inspiration_card(
    connection: &Connection,
    id: &str,
) -> rusqlite::Result<Option<InspirationCard>> {
    let row = connection
        .query_row(
            "
            SELECT
              inspiration_cards.id,
              inspiration_cards.card_type,
              inspiration_cards.title,
              inspiration_cards.source_platform,
              inspiration_cards.source_url,
              inspiration_cards.author_name,
              inspiration_cards.notes,
              inspiration_cards.project_id,
              projects.name AS project_name,
              inspiration_cards.cover_media_asset_id,
              inspiration_cards.collected_at,
              inspiration_cards.created_at,
              inspiration_cards.updated_at
            FROM inspiration_cards
            LEFT JOIN projects ON projects.id = inspiration_cards.project_id
            WHERE inspiration_cards.id = ?1
            ",
            [id],
            map_inspiration_row,
        )
        .optional()?;

    row.map(|row| hydrate_inspiration_card(connection, row))
        .transpose()
}

pub fn list_inspiration_cards(
    connection: &Connection,
    filters: &InspirationCardFilters,
) -> rusqlite::Result<Vec<InspirationCard>> {
    let mut statement = connection.prepare(
        "
        SELECT
          inspiration_cards.id,
          inspiration_cards.card_type,
          inspiration_cards.title,
          inspiration_cards.source_platform,
          inspiration_cards.source_url,
          inspiration_cards.author_name,
          inspiration_cards.notes,
          inspiration_cards.project_id,
          projects.name AS project_name,
          inspiration_cards.cover_media_asset_id,
          inspiration_cards.collected_at,
          inspiration_cards.created_at,
          inspiration_cards.updated_at
        FROM inspiration_cards
        LEFT JOIN projects ON projects.id = inspiration_cards.project_id
        ORDER BY inspiration_cards.collected_at DESC, inspiration_cards.created_at DESC
        ",
    )?;

    let rows = statement
        .query_map([], map_inspiration_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let keyword = normalize_optional_text(&filters.keyword).map(|value| value.to_lowercase());
    let card_type = normalize_optional_text(&filters.card_type);
    let project_id = normalize_optional_text(&filters.project_id);
    let source_platform = normalize_optional_text(&filters.source_platform);
    let tag_ids = normalized_ids(filters.tag_ids.as_deref().unwrap_or(&[]));

    let mut cards = Vec::new();
    for row in rows {
        let card = hydrate_inspiration_card(connection, row)?;

        if let Some(card_type) = card_type.as_deref() {
            if card.card_type != card_type {
                continue;
            }
        }

        if let Some(project_id) = project_id.as_deref() {
            if card.project_id.as_deref() != Some(project_id) {
                continue;
            }
        }

        if let Some(source_platform) = source_platform.as_deref() {
            if card.source_platform != source_platform {
                continue;
            }
        }

        if let Some(keyword) = keyword.as_deref() {
            let mut searchable_parts = [
                Some(card.title.as_str()),
                card.author_name.as_deref(),
                card.notes.as_deref(),
                card.source_url.as_deref(),
            ]
            .into_iter()
            .flatten()
            .map(str::to_owned)
            .collect::<Vec<_>>();
            searchable_parts.extend(card.tags.iter().map(|tag| tag.name.clone()));

            let haystack = searchable_parts.join("\n").to_lowercase();

            if !haystack.contains(keyword) {
                continue;
            }
        }

        if !tag_ids.is_empty()
            && !card
                .tags
                .iter()
                .any(|tag| tag_ids.iter().any(|tag_id| tag_id == &tag.id))
        {
            continue;
        }

        cards.push(card);
    }

    Ok(cards)
}

pub fn attach_tag_to_inspiration(
    connection: &Connection,
    inspiration_card_id: &str,
    tag_id: &str,
) -> rusqlite::Result<bool> {
    let changed = connection.execute(
        "
        INSERT OR IGNORE INTO inspiration_card_tags (inspiration_card_id, tag_id)
        VALUES (?1, ?2)
        ",
        params![inspiration_card_id, tag_id],
    )?;
    Ok(changed > 0)
}

pub fn detach_tag_from_inspiration(
    connection: &Connection,
    inspiration_card_id: &str,
    tag_id: &str,
) -> rusqlite::Result<bool> {
    let changed = connection.execute(
        "
        DELETE FROM inspiration_card_tags
        WHERE inspiration_card_id = ?1 AND tag_id = ?2
        ",
        params![inspiration_card_id, tag_id],
    )?;
    Ok(changed > 0)
}

pub fn attach_inspiration_to_project(
    connection: &Connection,
    project_id: &str,
    inspiration_card_id: &str,
) -> rusqlite::Result<bool> {
    let changed = connection.execute(
        "
        INSERT OR IGNORE INTO project_inspirations (
          project_id,
          inspiration_card_id,
          created_at
        )
        VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ",
        params![project_id, inspiration_card_id],
    )?;
    Ok(changed > 0)
}

pub fn detach_inspiration_from_project(
    connection: &Connection,
    project_id: &str,
    inspiration_card_id: &str,
) -> rusqlite::Result<bool> {
    let changed = connection.execute(
        "
        DELETE FROM project_inspirations
        WHERE project_id = ?1 AND inspiration_card_id = ?2
        ",
        params![project_id, inspiration_card_id],
    )?;
    Ok(changed > 0)
}

pub fn list_project_inspirations(
    connection: &Connection,
    project_id: &str,
) -> rusqlite::Result<Vec<InspirationCard>> {
    let mut statement = connection.prepare(
        "
        SELECT
          inspiration_cards.id,
          inspiration_cards.card_type,
          inspiration_cards.title,
          inspiration_cards.source_platform,
          inspiration_cards.source_url,
          inspiration_cards.author_name,
          inspiration_cards.notes,
          inspiration_cards.project_id,
          projects.name AS project_name,
          inspiration_cards.cover_media_asset_id,
          inspiration_cards.collected_at,
          inspiration_cards.created_at,
          inspiration_cards.updated_at
        FROM inspiration_cards
        INNER JOIN project_inspirations
          ON project_inspirations.inspiration_card_id = inspiration_cards.id
        LEFT JOIN projects ON projects.id = inspiration_cards.project_id
        WHERE project_inspirations.project_id = ?1
        ORDER BY project_inspirations.created_at DESC
        ",
    )?;

    let rows = statement
        .query_map([project_id], map_inspiration_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    rows.into_iter()
        .map(|row| hydrate_inspiration_card(connection, row))
        .collect()
}

pub fn inspiration_exists(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM inspiration_cards WHERE id = ?1)",
        [id],
        |row| row.get::<_, i64>(0).map(|value| value == 1),
    )
}

pub fn update_inspiration_card_cover(
    connection: &Connection,
    id: &str,
    cover_media_asset_id: Option<String>,
) -> rusqlite::Result<Option<InspirationCard>> {
    let updated_count = connection.execute(
        "
        UPDATE inspiration_cards
        SET
          cover_media_asset_id = ?2,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1
        ",
        params![id, normalize_optional_text(&cover_media_asset_id)],
    )?;

    if updated_count == 0 {
        return Ok(None);
    }

    get_inspiration_card(connection, id)
}

pub fn project_exists(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM projects WHERE id = ?1)",
        [id],
        |row| row.get::<_, i64>(0).map(|value| value == 1),
    )
}

pub fn tag_exists(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM tags WHERE id = ?1)",
        [id],
        |row| row.get::<_, i64>(0).map(|value| value == 1),
    )
}

fn replace_inspiration_tags(
    connection: &Connection,
    inspiration_card_id: &str,
    tag_ids: &[String],
) -> rusqlite::Result<()> {
    connection.execute(
        "DELETE FROM inspiration_card_tags WHERE inspiration_card_id = ?1",
        [inspiration_card_id],
    )?;

    for tag_id in normalized_ids(tag_ids) {
        connection.execute(
            "
            INSERT OR IGNORE INTO inspiration_card_tags (inspiration_card_id, tag_id)
            VALUES (?1, ?2)
            ",
            params![inspiration_card_id, tag_id],
        )?;
    }

    Ok(())
}

fn hydrate_inspiration_card(
    connection: &Connection,
    row: InspirationCardRow,
) -> rusqlite::Result<InspirationCard> {
    Ok(InspirationCard {
        tags: list_tags_for_inspiration(connection, &row.id)?,
        id: row.id,
        card_type: row.card_type,
        title: row.title,
        source_platform: row.source_platform,
        source_url: row.source_url,
        author_name: row.author_name,
        notes: row.notes,
        project_id: row.project_id,
        project_name: row.project_name,
        cover_media_asset_id: row.cover_media_asset_id,
        collected_at: row.collected_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

fn list_tags_for_inspiration(
    connection: &Connection,
    inspiration_card_id: &str,
) -> rusqlite::Result<Vec<Tag>> {
    let mut statement = connection.prepare(
        "
        SELECT
          tags.id,
          tags.name,
          tags.category,
          tags.color,
          tags.is_preset,
          tags.created_at,
          tags.updated_at
        FROM tags
        INNER JOIN inspiration_card_tags
          ON inspiration_card_tags.tag_id = tags.id
        WHERE inspiration_card_tags.inspiration_card_id = ?1
        ORDER BY tags.category ASC, tags.name ASC
        ",
    )?;

    let tags = statement
        .query_map([inspiration_card_id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                color: row.get(3)?,
                is_preset: row.get::<_, i64>(4)? == 1,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(tags)
}

fn map_inspiration_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<InspirationCardRow> {
    Ok(InspirationCardRow {
        id: row.get(0)?,
        card_type: row.get(1)?,
        title: row.get(2)?,
        source_platform: row.get(3)?,
        source_url: row.get(4)?,
        author_name: row.get(5)?,
        notes: row.get(6)?,
        project_id: row.get(7)?,
        project_name: row.get(8)?,
        cover_media_asset_id: row.get(9)?,
        collected_at: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn normalized_card_type(value: Option<&str>) -> String {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("inspiration")
        .to_string()
}

fn normalize_optional_text(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn normalized_ids(ids: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    for id in ids {
        let id = id.trim();
        if !id.is_empty() && !normalized.iter().any(|existing| existing == id) {
            normalized.push(id.to_string());
        }
    }
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;
    use crate::models::{CreateTagPayload, MediaAssetPayload, ProjectPayload};
    use crate::repositories::{media_repository, project_repository, tag_repository};

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("open in-memory database");
        migrations::run_migrations(&connection).expect("run migrations");
        migrations::seed_default_tags(&connection).expect("seed preset tags");
        connection
    }

    fn create_project(connection: &Connection) -> String {
        project_repository::create_project(
            connection,
            &ProjectPayload {
                name: "测试灵感项目".into(),
                theme: None,
                description: None,
                location: None,
                planned_shooting_time: None,
                notes: None,
                sort_order: None,
            },
        )
        .expect("create project")
        .id
    }

    fn create_tag(connection: &Connection, name: &str) -> String {
        tag_repository::create_custom_tag(
            connection,
            &CreateTagPayload {
                name: name.into(),
                category: Some("custom".into()),
                color: None,
            },
            "custom",
        )
        .expect("create tag")
        .id
    }

    fn create_media(connection: &Connection, card_id: &str, file_path: &str) -> String {
        media_repository::create_media_asset(
            connection,
            &MediaAssetPayload {
                target_type: "inspiration".into(),
                target_id: Some(card_id.into()),
                file_path: file_path.into(),
                original_filename: Some("test.jpg".into()),
                mime_type: Some("image/jpeg".into()),
                file_size: Some(1024),
                width: None,
                height: None,
                source_type: "file_picker".into(),
            },
        )
        .expect("create media")
        .id
    }

    #[test]
    fn create_get_update_delete_inspiration_card_with_tags() {
        let connection = test_connection();
        let project_id = create_project(&connection);
        let first_tag_id = create_tag(&connection, "测试灵感标签 A");
        let second_tag_id = create_tag(&connection, "测试灵感标签 B");

        let created = create_inspiration_card(
            &connection,
            &InspirationCardPayload {
                card_type: None,
                title: "咖啡馆窗边人像参考".into(),
                source_platform: "xiaohongshu".into(),
                source_url: Some("https://example.com/original".into()),
                author_name: Some("摄影作者".into()),
                notes: Some("窗边自然光".into()),
                project_id: Some(project_id.clone()),
                collected_at: None,
                tag_ids: Some(vec![first_tag_id.clone()]),
            },
        )
        .expect("create inspiration");

        assert_eq!(created.tags.len(), 1);
        assert_eq!(created.project_id.as_deref(), Some(project_id.as_str()));
        assert_eq!(created.project_name.as_deref(), Some("测试灵感项目"));

        let fetched = get_inspiration_card(&connection, &created.id)
            .expect("get inspiration")
            .expect("inspiration exists");
        assert_eq!(fetched.title, "咖啡馆窗边人像参考");
        assert_eq!(fetched.tags[0].id, first_tag_id);

        let updated = update_inspiration_card(
            &connection,
            &created.id,
            &InspirationCardPayload {
                card_type: None,
                title: "咖啡馆人像参考更新".into(),
                source_platform: "instagram".into(),
                source_url: None,
                author_name: Some("更新作者".into()),
                notes: Some("更新备注".into()),
                project_id: Some(project_id.clone()),
                collected_at: None,
                tag_ids: Some(vec![second_tag_id.clone()]),
            },
        )
        .expect("update inspiration")
        .expect("updated inspiration exists");

        assert_eq!(updated.title, "咖啡馆人像参考更新");
        assert_eq!(updated.tags.len(), 1);
        assert_eq!(updated.tags[0].id, second_tag_id);

        assert!(delete_inspiration_card(&connection, &created.id).expect("delete inspiration"));
        assert!(get_inspiration_card(&connection, &created.id)
            .expect("get deleted inspiration")
            .is_none());

        let relation_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM inspiration_card_tags WHERE inspiration_card_id = ?1",
                [created.id],
                |row| row.get(0),
            )
            .expect("count relations");
        assert_eq!(relation_count, 0);
    }

    #[test]
    fn attach_detach_and_cascade_project_inspirations() {
        let connection = test_connection();
        let project_id = create_project(&connection);
        let tag_id = create_tag(&connection, "项目参考标签");
        let card = create_inspiration_card(
            &connection,
            &InspirationCardPayload {
                card_type: None,
                title: "项目参考灵感".into(),
                source_platform: "xiaohongshu".into(),
                source_url: None,
                author_name: None,
                notes: None,
                project_id: None,
                collected_at: None,
                tag_ids: Some(vec![tag_id]),
            },
        )
        .expect("create inspiration");

        assert!(
            attach_inspiration_to_project(&connection, &project_id, &card.id)
                .expect("attach inspiration to project")
        );
        assert!(
            !attach_inspiration_to_project(&connection, &project_id, &card.id)
                .expect("attach duplicate inspiration to project")
        );

        let linked =
            list_project_inspirations(&connection, &project_id).expect("list project inspirations");
        assert_eq!(linked.len(), 1);
        assert_eq!(linked[0].id, card.id);

        assert!(
            detach_inspiration_from_project(&connection, &project_id, &card.id)
                .expect("detach inspiration from project")
        );
        assert!(list_project_inspirations(&connection, &project_id)
            .expect("list after detach")
            .is_empty());

        assert!(
            attach_inspiration_to_project(&connection, &project_id, &card.id)
                .expect("attach again")
        );
        project_repository::delete_project(&connection, &project_id).expect("delete project");
        let relation_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM project_inspirations", [], |row| {
                row.get(0)
            })
            .expect("count relations after project delete");
        assert_eq!(relation_count, 0);

        let project_id = create_project(&connection);
        assert!(
            attach_inspiration_to_project(&connection, &project_id, &card.id)
                .expect("attach before card delete")
        );
        assert!(delete_inspiration_card(&connection, &card.id).expect("delete inspiration"));
        let relation_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM project_inspirations", [], |row| {
                row.get(0)
            })
            .expect("count relations after card delete");
        assert_eq!(relation_count, 0);
    }

    #[test]
    fn update_inspiration_card_cover_is_returned_by_get_and_list() {
        let connection = test_connection();
        let card = create_inspiration_card(
            &connection,
            &InspirationCardPayload {
                card_type: None,
                title: "封面卡片".into(),
                source_platform: "xiaohongshu".into(),
                source_url: None,
                author_name: None,
                notes: None,
                project_id: None,
                collected_at: None,
                tag_ids: Some(vec![]),
            },
        )
        .expect("create card");
        let media_id = create_media(&connection, &card.id, "/media/inspiration/cover.jpg");

        let updated = update_inspiration_card_cover(&connection, &card.id, Some(media_id.clone()))
            .expect("update cover")
            .expect("card exists");
        assert_eq!(updated.cover_media_asset_id.as_deref(), Some(media_id.as_str()));

        let fetched = get_inspiration_card(&connection, &card.id)
            .expect("get card")
            .expect("card exists");
        assert_eq!(fetched.cover_media_asset_id.as_deref(), Some(media_id.as_str()));

        let listed = list_inspiration_cards(
            &connection,
            &InspirationCardFilters {
                card_type: None,
                project_id: None,
                source_platform: None,
                keyword: Some("封面卡片".into()),
                tag_ids: None,
            },
        )
        .expect("list cards");
        assert_eq!(listed[0].cover_media_asset_id.as_deref(), Some(media_id.as_str()));

        let cleared = update_inspiration_card_cover(&connection, &card.id, None)
            .expect("clear cover")
            .expect("card exists");
        assert!(cleared.cover_media_asset_id.is_none());
    }

    #[test]
    fn list_inspiration_cards_filters_by_keyword_project_platform_and_any_tag() {
        let connection = test_connection();
        let project_id = create_project(&connection);
        let matching_tag_id = create_tag(&connection, "筛选标签 A");
        let other_tag_id = create_tag(&connection, "筛选标签 B");

        let matching = create_inspiration_card(
            &connection,
            &InspirationCardPayload {
                card_type: None,
                title: "咖啡馆窗边人像参考".into(),
                source_platform: "xiaohongshu".into(),
                source_url: Some("https://example.com/window".into()),
                author_name: Some("作者A".into()),
                notes: Some("适合自然光关键词".into()),
                project_id: Some(project_id.clone()),
                collected_at: None,
                tag_ids: Some(vec![matching_tag_id.clone()]),
            },
        )
        .expect("create matching card");

        create_inspiration_card(
            &connection,
            &InspirationCardPayload {
                card_type: None,
                title: "夜景霓虹参考".into(),
                source_platform: "youtube".into(),
                source_url: None,
                author_name: Some("作者B".into()),
                notes: Some("夜晚街头".into()),
                project_id: None,
                collected_at: None,
                tag_ids: Some(vec![other_tag_id.clone()]),
            },
        )
        .expect("create other card");

        let filtered = list_inspiration_cards(
            &connection,
            &InspirationCardFilters {
                card_type: None,
                project_id: Some(project_id),
                source_platform: Some("xiaohongshu".into()),
                keyword: Some("自然光".into()),
                tag_ids: Some(vec![matching_tag_id]),
            },
        )
        .expect("filter inspirations");

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].id, matching.id);

        let any_tag_filtered = list_inspiration_cards(
            &connection,
            &InspirationCardFilters {
                card_type: None,
                project_id: None,
                source_platform: None,
                keyword: None,
                tag_ids: Some(vec![other_tag_id]),
            },
        )
        .expect("filter by any tag");
        assert_eq!(any_tag_filtered.len(), 1);
        assert_eq!(any_tag_filtered[0].title, "夜景霓虹参考");

        let tag_keyword_filtered = list_inspiration_cards(
            &connection,
            &InspirationCardFilters {
                card_type: None,
                project_id: None,
                source_platform: None,
                keyword: Some("筛选标签 B".into()),
                tag_ids: None,
            },
        )
        .expect("filter by tag name keyword");
        assert_eq!(tag_keyword_filtered.len(), 1);
        assert_eq!(tag_keyword_filtered[0].title, "夜景霓虹参考");
    }

    #[test]
    fn card_type_defaults_updates_and_filters() {
        let connection = test_connection();
        let tag_id = create_tag(&connection, "技巧测试标签");

        let inspiration = create_inspiration_card(
            &connection,
            &InspirationCardPayload {
                card_type: None,
                title: "默认灵感卡".into(),
                source_platform: "xiaohongshu".into(),
                source_url: None,
                author_name: None,
                notes: Some("默认应为灵感".into()),
                project_id: None,
                collected_at: None,
                tag_ids: Some(vec![tag_id.clone()]),
            },
        )
        .expect("create default inspiration card");
        assert_eq!(inspiration.card_type, "inspiration");
        assert_eq!(inspiration.tags.len(), 1);

        let technique = create_inspiration_card(
            &connection,
            &InspirationCardPayload {
                card_type: Some("technique".into()),
                title: "窗边光布光技巧".into(),
                source_platform: "youtube".into(),
                source_url: None,
                author_name: None,
                notes: Some("记录布光步骤".into()),
                project_id: None,
                collected_at: None,
                tag_ids: Some(vec![tag_id]),
            },
        )
        .expect("create technique card");
        assert_eq!(technique.card_type, "technique");

        let updated = update_inspiration_card(
            &connection,
            &inspiration.id,
            &InspirationCardPayload {
                card_type: Some("technique".into()),
                title: "默认灵感卡改为技巧".into(),
                source_platform: "xiaohongshu".into(),
                source_url: None,
                author_name: None,
                notes: Some("更新卡片类型".into()),
                project_id: None,
                collected_at: None,
                tag_ids: Some(vec![]),
            },
        )
        .expect("update card type")
        .expect("updated card exists");
        assert_eq!(updated.card_type, "technique");

        let all_cards = list_inspiration_cards(
            &connection,
            &InspirationCardFilters {
                card_type: None,
                project_id: None,
                source_platform: None,
                keyword: None,
                tag_ids: None,
            },
        )
        .expect("list all cards");
        assert_eq!(all_cards.len(), 2);

        let inspiration_cards = list_inspiration_cards(
            &connection,
            &InspirationCardFilters {
                card_type: Some("inspiration".into()),
                project_id: None,
                source_platform: None,
                keyword: None,
                tag_ids: None,
            },
        )
        .expect("list inspiration cards");
        assert!(inspiration_cards.is_empty());

        let technique_cards = list_inspiration_cards(
            &connection,
            &InspirationCardFilters {
                card_type: Some("technique".into()),
                project_id: None,
                source_platform: None,
                keyword: None,
                tag_ids: None,
            },
        )
        .expect("list technique cards");
        assert_eq!(technique_cards.len(), 2);
        assert!(technique_cards
            .iter()
            .all(|card| card.card_type == "technique"));
    }
}
