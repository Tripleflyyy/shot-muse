use std::collections::HashSet;

use rusqlite::{params, Connection};

use crate::models::{InspirationCard, InspirationCardFilters};
use crate::repositories::{inspiration_repository, shooting_plan_repository};

pub fn attach_inspiration_to_shooting_plan(
    connection: &Connection,
    shooting_plan_id: &str,
    inspiration_card_id: &str,
) -> rusqlite::Result<bool> {
    let changed = connection.execute(
        "
        INSERT OR IGNORE INTO shooting_plan_inspirations (
          shooting_plan_id,
          inspiration_card_id
        )
        VALUES (?1, ?2)
        ",
        params![shooting_plan_id, inspiration_card_id],
    )?;
    Ok(changed > 0)
}

pub fn detach_inspiration_from_shooting_plan(
    connection: &Connection,
    shooting_plan_id: &str,
    inspiration_card_id: &str,
) -> rusqlite::Result<bool> {
    let changed = connection.execute(
        "
        DELETE FROM shooting_plan_inspirations
        WHERE shooting_plan_id = ?1 AND inspiration_card_id = ?2
        ",
        params![shooting_plan_id, inspiration_card_id],
    )?;
    Ok(changed > 0)
}

pub fn list_shooting_plan_inspirations(
    connection: &Connection,
    shooting_plan_id: &str,
) -> rusqlite::Result<Vec<InspirationCard>> {
    let mut statement = connection.prepare(
        "
        SELECT inspiration_card_id
        FROM shooting_plan_inspirations
        WHERE shooting_plan_id = ?1
        ORDER BY inspiration_card_id ASC
        ",
    )?;

    let inspiration_ids = statement
        .query_map([shooting_plan_id], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    inspiration_ids
        .into_iter()
        .map(|id| {
            inspiration_repository::get_inspiration_card(connection, &id)?
                .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
        })
        .collect()
}

pub fn list_available_inspirations_for_shooting_plan(
    connection: &Connection,
    shooting_plan_id: &str,
    keyword: Option<&str>,
    source_platform: Option<&str>,
) -> rusqlite::Result<Vec<InspirationCard>> {
    let linked_ids = list_shooting_plan_inspiration_ids(connection, shooting_plan_id)?
        .into_iter()
        .collect::<HashSet<_>>();

    let cards = inspiration_repository::list_inspiration_cards(
        connection,
            &InspirationCardFilters {
                card_type: None,
                project_id: None,
            source_platform: source_platform.map(ToOwned::to_owned),
            keyword: keyword.map(ToOwned::to_owned),
            tag_ids: Some(Vec::new()),
        },
    )?;

    Ok(cards
        .into_iter()
        .filter(|card| !linked_ids.contains(&card.id))
        .collect())
}

pub fn shooting_plan_exists(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    shooting_plan_repository::shooting_plan_exists(connection, id)
}

pub fn inspiration_exists(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    inspiration_repository::inspiration_exists(connection, id)
}

fn list_shooting_plan_inspiration_ids(
    connection: &Connection,
    shooting_plan_id: &str,
) -> rusqlite::Result<Vec<String>> {
    let mut statement = connection.prepare(
        "
        SELECT inspiration_card_id
        FROM shooting_plan_inspirations
        WHERE shooting_plan_id = ?1
        ",
    )?;

    let ids = statement
        .query_map([shooting_plan_id], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;
    use crate::models::{
        CreateTagPayload, InspirationCardPayload, ProjectPayload, ShootingPlanPayload,
    };
    use crate::repositories::{project_repository, tag_repository};

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("open in-memory database");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        migrations::run_migrations(&connection).expect("run migrations");
        migrations::seed_default_tags(&connection).expect("seed preset tags");
        connection
    }

    fn create_project(connection: &Connection) -> String {
        project_repository::create_project(
            connection,
            &ProjectPayload {
                name: "计划项目".into(),
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

    fn create_plan(connection: &Connection, project_id: &str) -> String {
        shooting_plan_repository::create_shooting_plan(
            connection,
            &ShootingPlanPayload {
                project_id: project_id.into(),
                title: "咖啡馆拍摄计划".into(),
                shooting_theme: None,
                gear_list: None,
                scene_list: None,
                action_list: None,
                composition_reference: None,
                lighting_reference: None,
                post_style: None,
                technique_notes: None,
                notes: None,
                sort_order: None,
                status: Some("draft".into()),
            },
        )
        .expect("create shooting plan")
        .id
    }

    fn create_tag(connection: &Connection) -> String {
        tag_repository::create_custom_tag(
            connection,
            &CreateTagPayload {
                name: "自然光".into(),
                category: Some("custom".into()),
                color: None,
            },
            "custom",
        )
        .expect("create tag")
        .id
    }

    fn create_inspiration(connection: &Connection, title: &str, tag_id: Option<String>) -> String {
        inspiration_repository::create_inspiration_card(
            connection,
            &InspirationCardPayload {
                card_type: None,
                title: title.into(),
                source_platform: "xiaohongshu".into(),
                source_url: Some("https://example.com".into()),
                author_name: Some("摄影作者".into()),
                notes: Some("窗边自然光参考".into()),
                project_id: None,
                collected_at: None,
                tag_ids: Some(tag_id.into_iter().collect()),
            },
        )
        .expect("create inspiration")
        .id
    }

    #[test]
    fn attach_list_detach_and_keep_inspiration_card() {
        let connection = test_connection();
        let project_id = create_project(&connection);
        let plan_id = create_plan(&connection, &project_id);
        let inspiration_id = create_inspiration(&connection, "咖啡馆窗边人像", None);

        assert!(
            attach_inspiration_to_shooting_plan(&connection, &plan_id, &inspiration_id)
                .expect("attach inspiration")
        );
        assert!(
            !attach_inspiration_to_shooting_plan(&connection, &plan_id, &inspiration_id)
                .expect("duplicate attach")
        );

        let linked = list_shooting_plan_inspirations(&connection, &plan_id).expect("list linked");
        assert_eq!(linked.len(), 1);
        assert_eq!(linked[0].id, inspiration_id);

        assert!(
            detach_inspiration_from_shooting_plan(&connection, &plan_id, &inspiration_id)
                .expect("detach inspiration")
        );
        let linked =
            list_shooting_plan_inspirations(&connection, &plan_id).expect("list after detach");
        assert!(linked.is_empty());
        assert!(
            inspiration_repository::get_inspiration_card(&connection, &inspiration_id)
                .expect("get inspiration")
                .is_some()
        );
    }

    #[test]
    fn cascades_when_plan_or_inspiration_is_deleted() {
        let connection = test_connection();
        let project_id = create_project(&connection);
        let first_plan_id = create_plan(&connection, &project_id);
        let first_inspiration_id = create_inspiration(&connection, "级联灵感 A", None);
        attach_inspiration_to_shooting_plan(&connection, &first_plan_id, &first_inspiration_id)
            .expect("attach first");

        shooting_plan_repository::delete_shooting_plan(&connection, &first_plan_id)
            .expect("delete plan");
        let relation_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM shooting_plan_inspirations WHERE shooting_plan_id = ?1",
                [first_plan_id],
                |row| row.get(0),
            )
            .expect("count plan relations");
        assert_eq!(relation_count, 0);

        let second_plan_id = create_plan(&connection, &project_id);
        let second_inspiration_id = create_inspiration(&connection, "级联灵感 B", None);
        attach_inspiration_to_shooting_plan(&connection, &second_plan_id, &second_inspiration_id)
            .expect("attach second");

        inspiration_repository::delete_inspiration_card(&connection, &second_inspiration_id)
            .expect("delete inspiration");
        let relation_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM shooting_plan_inspirations WHERE inspiration_card_id = ?1",
                [second_inspiration_id],
                |row| row.get(0),
            )
            .expect("count inspiration relations");
        assert_eq!(relation_count, 0);
    }

    #[test]
    fn available_inspirations_excludes_linked_and_searches_tags() {
        let connection = test_connection();
        let project_id = create_project(&connection);
        let plan_id = create_plan(&connection, &project_id);
        let tag_id = create_tag(&connection);
        let linked_id = create_inspiration(&connection, "已加入灵感", None);
        let available_id = create_inspiration(&connection, "可加入灵感", Some(tag_id));

        attach_inspiration_to_shooting_plan(&connection, &plan_id, &linked_id)
            .expect("attach linked");

        let available = list_available_inspirations_for_shooting_plan(
            &connection,
            &plan_id,
            Some("自然光"),
            Some("xiaohongshu"),
        )
        .expect("list available");

        assert_eq!(available.len(), 1);
        assert_eq!(available[0].id, available_id);
    }
}
