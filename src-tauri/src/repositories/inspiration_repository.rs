use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{InspirationCard, InspirationCardFilters, InspirationCardPayload, Tag};

#[derive(Debug, Clone)]
struct InspirationCardRow {
    id: String,
    title: String,
    source_platform: String,
    source_url: Option<String>,
    author_name: Option<String>,
    notes: Option<String>,
    project_id: Option<String>,
    project_name: Option<String>,
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
          COALESCE(?8, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        )
        ",
        params![
            id,
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
          title = ?2,
          source_platform = ?3,
          source_url = ?4,
          author_name = ?5,
          notes = ?6,
          project_id = ?7,
          collected_at = COALESCE(?8, collected_at),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1
        ",
        params![
            id,
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
              inspiration_cards.title,
              inspiration_cards.source_platform,
              inspiration_cards.source_url,
              inspiration_cards.author_name,
              inspiration_cards.notes,
              inspiration_cards.project_id,
              projects.name AS project_name,
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
          inspiration_cards.title,
          inspiration_cards.source_platform,
          inspiration_cards.source_url,
          inspiration_cards.author_name,
          inspiration_cards.notes,
          inspiration_cards.project_id,
          projects.name AS project_name,
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
    let project_id = normalize_optional_text(&filters.project_id);
    let source_platform = normalize_optional_text(&filters.source_platform);
    let tag_ids = normalized_ids(filters.tag_ids.as_deref().unwrap_or(&[]));

    let mut cards = Vec::new();
    for row in rows {
        let card = hydrate_inspiration_card(connection, row)?;

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
            let haystack = [
                Some(card.title.as_str()),
                card.author_name.as_deref(),
                card.notes.as_deref(),
                card.source_url.as_deref(),
            ]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join("\n")
            .to_lowercase();

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

pub fn inspiration_exists(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM inspiration_cards WHERE id = ?1)",
        [id],
        |row| row.get::<_, i64>(0).map(|value| value == 1),
    )
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
        title: row.title,
        source_platform: row.source_platform,
        source_url: row.source_url,
        author_name: row.author_name,
        notes: row.notes,
        project_id: row.project_id,
        project_name: row.project_name,
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
        title: row.get(1)?,
        source_platform: row.get(2)?,
        source_url: row.get(3)?,
        author_name: row.get(4)?,
        notes: row.get(5)?,
        project_id: row.get(6)?,
        project_name: row.get(7)?,
        collected_at: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
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
    use crate::models::{CreateTagPayload, ProjectPayload};
    use crate::repositories::{project_repository, tag_repository};

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

    #[test]
    fn create_get_update_delete_inspiration_card_with_tags() {
        let connection = test_connection();
        let project_id = create_project(&connection);
        let first_tag_id = create_tag(&connection, "测试灵感标签 A");
        let second_tag_id = create_tag(&connection, "测试灵感标签 B");

        let created = create_inspiration_card(
            &connection,
            &InspirationCardPayload {
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
    fn list_inspiration_cards_filters_by_keyword_project_platform_and_any_tag() {
        let connection = test_connection();
        let project_id = create_project(&connection);
        let matching_tag_id = create_tag(&connection, "筛选标签 A");
        let other_tag_id = create_tag(&connection, "筛选标签 B");

        let matching = create_inspiration_card(
            &connection,
            &InspirationCardPayload {
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
                project_id: None,
                source_platform: None,
                keyword: None,
                tag_ids: Some(vec![other_tag_id]),
            },
        )
        .expect("filter by any tag");
        assert_eq!(any_tag_filtered.len(), 1);
        assert_eq!(any_tag_filtered[0].title, "夜景霓虹参考");
    }
}
