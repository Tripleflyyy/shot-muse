use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{CreateTagPayload, PresetTag, Tag, TagUsage, UpdateTagPayload};

const DEFAULT_TAGS: &[PresetTag] = &[
    PresetTag::new("人像", "subject", "#F97316"),
    PresetTag::new("街拍", "subject", "#F97316"),
    PresetTag::new("风景", "subject", "#F97316"),
    PresetTag::new("夜景", "subject", "#F97316"),
    PresetTag::new("旅行", "subject", "#F97316"),
    PresetTag::new("美食", "subject", "#F97316"),
    PresetTag::new("宠物", "subject", "#F97316"),
    PresetTag::new("建筑", "subject", "#F97316"),
    PresetTag::new("逆光", "lighting", "#FACC15"),
    PresetTag::new("侧光", "lighting", "#FACC15"),
    PresetTag::new("窗边光", "lighting", "#FACC15"),
    PresetTag::new("蓝调时刻", "lighting", "#FACC15"),
    PresetTag::new("夕阳", "lighting", "#FACC15"),
    PresetTag::new("霓虹", "lighting", "#FACC15"),
    PresetTag::new("硬光", "lighting", "#FACC15"),
    PresetTag::new("柔光", "lighting", "#FACC15"),
    PresetTag::new("三分法", "composition", "#22C55E"),
    PresetTag::new("中心构图", "composition", "#22C55E"),
    PresetTag::new("框架构图", "composition", "#22C55E"),
    PresetTag::new("前景遮挡", "composition", "#22C55E"),
    PresetTag::new("对称构图", "composition", "#22C55E"),
    PresetTag::new("低角度", "composition", "#22C55E"),
    PresetTag::new("俯拍", "composition", "#22C55E"),
    PresetTag::new("暖色", "color", "#EF4444"),
    PresetTag::new("冷色", "color", "#3B82F6"),
    PresetTag::new("低饱和", "color", "#64748B"),
    PresetTag::new("高对比", "color", "#111827"),
    PresetTag::new("胶片感", "color", "#A16207"),
    PresetTag::new("黑白", "color", "#525252"),
    PresetTag::new("日系", "color", "#EC4899"),
    PresetTag::new("港风", "color", "#DC2626"),
    PresetTag::new("松弛", "mood", "#14B8A6"),
    PresetTag::new("孤独", "mood", "#6366F1"),
    PresetTag::new("浪漫", "mood", "#F472B6"),
    PresetTag::new("复古", "mood", "#92400E"),
    PresetTag::new("清冷", "mood", "#0EA5E9"),
    PresetTag::new("自由", "mood", "#10B981"),
    PresetTag::new("故事感", "mood", "#8B5CF6"),
    PresetTag::new("布光", "technique", "#F59E0B"),
    PresetTag::new("构图", "technique", "#F59E0B"),
    PresetTag::new("调色", "technique", "#F59E0B"),
    PresetTag::new("人像引导", "technique", "#F59E0B"),
    PresetTag::new("后期处理", "technique", "#F59E0B"),
    PresetTag::new("器材使用", "technique", "#F59E0B"),
];

pub fn insert_preset_tags(connection: &Connection) -> rusqlite::Result<usize> {
    let now = "1970-01-01T00:00:00Z";
    let transaction = connection.unchecked_transaction()?;
    let mut inserted_count = 0;

    {
        let mut statement = transaction.prepare(
            "
            INSERT OR IGNORE INTO tags (
              id,
              name,
              category,
              color,
              is_preset,
              created_at,
              updated_at
            )
            VALUES (?1, ?2, ?3, ?4, 1, ?5, ?5)
            ",
        )?;

        for tag in DEFAULT_TAGS {
            inserted_count += statement.execute(params![
                preset_tag_id(tag.name, tag.category),
                tag.name,
                tag.category,
                tag.color,
                now,
            ])?;
        }
    }

    transaction.commit()?;
    Ok(inserted_count)
}

pub fn preset_tag_count() -> usize {
    DEFAULT_TAGS.len()
}

fn preset_tag_id(name: &str, category: &str) -> String {
    format!("preset:{}:{}", category, name)
}

pub fn list_tags(connection: &Connection, category: Option<&str>) -> rusqlite::Result<Vec<Tag>> {
    if let Some(category) = category.map(str::trim).filter(|value| !value.is_empty()) {
        let mut statement = connection.prepare(
            "
            SELECT id, name, category, color, is_preset, created_at, updated_at
            FROM tags
            WHERE category = ?1
            ORDER BY category ASC, is_preset DESC, name ASC
            ",
        )?;
        return statement
            .query_map([category], map_tag)?
            .collect::<rusqlite::Result<Vec<_>>>();
    }

    let mut statement = connection.prepare(
        "
        SELECT id, name, category, color, is_preset, created_at, updated_at
        FROM tags
        ORDER BY category ASC, is_preset DESC, name ASC
        ",
    )?;

    let tags = statement
        .query_map([], map_tag)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(tags)
}

pub fn create_custom_tag(
    connection: &Connection,
    payload: &CreateTagPayload,
    category: &str,
) -> rusqlite::Result<Tag> {
    let id = Uuid::new_v4().to_string();

    connection.execute(
        "
        INSERT INTO tags (
          id,
          name,
          category,
          color,
          is_preset,
          created_at,
          updated_at
        )
        VALUES (
          ?1,
          ?2,
          ?3,
          ?4,
          0,
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        )
        ",
        params![
            id,
            payload.name.trim(),
            category,
            normalize_optional_text(&payload.color),
        ],
    )?;

    get_tag(connection, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn update_tag(
    connection: &Connection,
    id: &str,
    payload: &UpdateTagPayload,
    category: &str,
) -> rusqlite::Result<Option<Tag>> {
    let updated_count = connection.execute(
        "
        UPDATE tags
        SET
          name = ?2,
          category = ?3,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1
        ",
        params![id, payload.name.trim(), category],
    )?;

    if updated_count == 0 {
        return Ok(None);
    }

    get_tag(connection, id)
}

pub fn update_tag_color(
    connection: &Connection,
    id: &str,
    color: Option<&str>,
) -> rusqlite::Result<Option<Tag>> {
    let updated_count = connection.execute(
        "
        UPDATE tags
        SET
          color = ?2,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1
        ",
        params![id, color],
    )?;

    if updated_count == 0 {
        return Ok(None);
    }

    get_tag(connection, id)
}

pub fn delete_tag(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    let deleted_count = connection.execute("DELETE FROM tags WHERE id = ?1", [id])?;
    Ok(deleted_count > 0)
}

pub fn get_tag(connection: &Connection, id: &str) -> rusqlite::Result<Option<Tag>> {
    connection
        .query_row(
            "
            SELECT id, name, category, color, is_preset, created_at, updated_at
            FROM tags
            WHERE id = ?1
            ",
            [id],
            map_tag,
        )
        .optional()
}

pub fn find_tag_by_name_and_category(
    connection: &Connection,
    name: &str,
    category: &str,
) -> rusqlite::Result<Option<Tag>> {
    connection
        .query_row(
            "
            SELECT id, name, category, color, is_preset, created_at, updated_at
            FROM tags
            WHERE name = ?1 AND category = ?2
            ",
            params![name.trim(), category],
            map_tag,
        )
        .optional()
}

pub fn list_tags_by_inspiration_usage(connection: &Connection) -> rusqlite::Result<Vec<TagUsage>> {
    let mut statement = connection.prepare(
        "
        SELECT
          tags.id,
          tags.name,
          tags.category,
          tags.color,
          tags.is_preset,
          tags.created_at,
          tags.updated_at,
          COUNT(inspiration_card_tags.inspiration_card_id) AS usage_count
        FROM tags
        LEFT JOIN inspiration_card_tags
          ON inspiration_card_tags.tag_id = tags.id
        GROUP BY tags.id
        ORDER BY usage_count DESC, tags.category ASC, tags.name ASC
        ",
    )?;

    let usages = statement
        .query_map([], |row| {
            Ok(TagUsage {
                tag: Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    category: row.get(2)?,
                    color: row.get(3)?,
                    is_preset: row.get::<_, i64>(4)? == 1,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                },
                usage_count: row.get(7)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(usages)
}

fn map_tag(row: &rusqlite::Row<'_>) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: row.get(0)?,
        name: row.get(1)?,
        category: row.get(2)?,
        color: row.get(3)?,
        is_preset: row.get::<_, i64>(4)? == 1,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
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
    use crate::db::migrations;

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("open in-memory database");
        migrations::run_migrations(&connection).expect("run migrations");
        migrations::seed_default_tags(&connection).expect("seed preset tags");
        connection
    }

    #[test]
    fn create_update_and_delete_custom_tag() {
        let connection = test_connection();
        let created = create_custom_tag(
            &connection,
            &CreateTagPayload {
                name: "电影感测试".into(),
                category: Some("custom".into()),
                color: Some("#FFAA00".into()),
            },
            "custom",
        )
        .expect("create custom tag");
        assert!(!created.is_preset);

        let updated = update_tag(
            &connection,
            &created.id,
            &UpdateTagPayload {
                name: "电影色调测试".into(),
                category: Some("color".into()),
            },
            "color",
        )
        .expect("update custom tag")
        .expect("updated tag exists");
        assert_eq!(updated.name, "电影色调测试");
        assert_eq!(updated.category, "color");

        let recolored = update_tag_color(&connection, &created.id, Some("#00AAFF"))
            .expect("update tag color")
            .expect("recolored tag exists");
        assert_eq!(recolored.color.as_deref(), Some("#00AAFF"));

        assert!(delete_tag(&connection, &created.id).expect("delete custom tag"));
        assert!(get_tag(&connection, &created.id)
            .expect("get deleted tag")
            .is_none());
        assert!(!delete_tag(&connection, &created.id).expect("delete missing tag"));
    }

    #[test]
    fn preset_tags_are_marked_as_preset() {
        let connection = test_connection();
        let preset_tags = list_tags(&connection, Some("subject")).expect("list preset tags");
        assert!(preset_tags
            .iter()
            .any(|tag| tag.name == "人像" && tag.is_preset));
    }
}
