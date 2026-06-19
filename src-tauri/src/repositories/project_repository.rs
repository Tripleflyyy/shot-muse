use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{Project, ProjectPayload};

pub fn create_project(
    connection: &Connection,
    payload: &ProjectPayload,
) -> rusqlite::Result<Project> {
    let id = Uuid::new_v4().to_string();
    let sort_order = payload
        .sort_order
        .unwrap_or_else(|| next_sort_order(connection).unwrap_or(0));

    connection.execute(
        "
        INSERT INTO projects (
          id,
          name,
          theme,
          description,
          location,
          planned_shooting_time,
          notes,
          sort_order,
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
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        )
        ",
        params![
            id,
            payload.name.trim(),
            normalize_optional_text(&payload.theme),
            normalize_optional_text(&payload.description),
            normalize_optional_text(&payload.location),
            normalize_optional_text(&payload.planned_shooting_time),
            normalize_optional_text(&payload.notes),
            sort_order,
        ],
    )?;

    get_project(connection, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn update_project(
    connection: &Connection,
    id: &str,
    payload: &ProjectPayload,
) -> rusqlite::Result<Option<Project>> {
    let updated_count = connection.execute(
        "
        UPDATE projects
        SET
          name = ?2,
          theme = ?3,
          description = ?4,
          location = ?5,
          planned_shooting_time = ?6,
          notes = ?7,
          sort_order = ?8,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1
        ",
        params![
            id,
            payload.name.trim(),
            normalize_optional_text(&payload.theme),
            normalize_optional_text(&payload.description),
            normalize_optional_text(&payload.location),
            normalize_optional_text(&payload.planned_shooting_time),
            normalize_optional_text(&payload.notes),
            payload.sort_order.unwrap_or_else(|| current_sort_order(connection, id).unwrap_or(0)),
        ],
    )?;

    if updated_count == 0 {
        return Ok(None);
    }

    get_project(connection, id)
}

pub fn delete_project(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    let deleted_count = connection.execute("DELETE FROM projects WHERE id = ?1", [id])?;
    Ok(deleted_count > 0)
}

pub fn get_project(connection: &Connection, id: &str) -> rusqlite::Result<Option<Project>> {
    connection
        .query_row(
            "
            SELECT
              id,
              name,
              theme,
              description,
              location,
              planned_shooting_time,
              notes,
              sort_order,
              created_at,
              updated_at
            FROM projects
            WHERE id = ?1
            ",
            [id],
            map_project,
        )
        .optional()
}

pub fn list_projects(
    connection: &Connection,
    keyword: Option<&str>,
) -> rusqlite::Result<Vec<Project>> {
    let normalized_keyword = keyword.map(str::trim).filter(|value| !value.is_empty());

    if let Some(keyword) = normalized_keyword {
        let like_keyword = format!("%{}%", keyword);
        let mut statement = connection.prepare(
            "
            SELECT
              id,
              name,
              theme,
              description,
              location,
              planned_shooting_time,
              notes,
              sort_order,
              created_at,
              updated_at
            FROM projects
            WHERE
              name LIKE ?1
              OR theme LIKE ?1
              OR description LIKE ?1
            ORDER BY sort_order ASC, updated_at DESC
            ",
        )?;
        let projects = statement
            .query_map([like_keyword], map_project)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        return Ok(projects);
    }

    let mut statement = connection.prepare(
        "
        SELECT
          id,
          name,
          theme,
          description,
          location,
          planned_shooting_time,
          notes,
          sort_order,
          created_at,
          updated_at
        FROM projects
        ORDER BY sort_order ASC, updated_at DESC
        ",
    )?;

    let projects = statement
        .query_map([], map_project)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(projects)
}

fn map_project(row: &rusqlite::Row<'_>) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        theme: row.get(2)?,
        description: row.get(3)?,
        location: row.get(4)?,
        planned_shooting_time: row.get(5)?,
        notes: row.get(6)?,
        sort_order: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

pub fn reorder_projects(
    connection: &Connection,
    ordered_project_ids: &[String],
) -> rusqlite::Result<Vec<Project>> {
    let transaction = connection.unchecked_transaction()?;

    for (index, project_id) in ordered_project_ids.iter().enumerate() {
        let exists = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM projects WHERE id = ?1)",
            [project_id],
            |row| row.get::<_, i64>(0).map(|value| value == 1),
        )?;

        if !exists {
            return Err(rusqlite::Error::InvalidParameterName(
                "项目排序参数不合法：项目不存在".to_string(),
            ));
        }

        transaction.execute(
            "UPDATE projects SET sort_order = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
            params![project_id, index as i64],
        )?;
    }

    transaction.commit()?;
    list_projects(connection, None)
}

fn next_sort_order(connection: &Connection) -> rusqlite::Result<i64> {
    connection.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM projects",
        [],
        |row| row.get(0),
    )
}

fn current_sort_order(connection: &Connection, id: &str) -> rusqlite::Result<i64> {
    connection.query_row("SELECT sort_order FROM projects WHERE id = ?1", [id], |row| row.get(0))
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
        connection
    }

    #[test]
    fn create_search_update_and_delete_project() {
        let connection = test_connection();
        let created = create_project(
            &connection,
            &ProjectPayload {
                name: "测试人像拍摄".into(),
                theme: Some("人像练习".into()),
                description: Some("午后自然光".into()),
                location: None,
                planned_shooting_time: None,
                notes: None,
                sort_order: None,
            },
        )
        .expect("create project");
        assert_eq!(created.sort_order, 0);

        let search_results = list_projects(&connection, Some("人像")).expect("search projects");
        assert_eq!(search_results.len(), 1);
        assert_eq!(search_results[0].id, created.id);

        let updated = update_project(
            &connection,
            &created.id,
            &ProjectPayload {
                name: "测试人像拍摄".into(),
                theme: Some("胶片人像".into()),
                description: Some("编辑后的描述".into()),
                location: Some("公园".into()),
                planned_shooting_time: None,
                notes: Some("带反光板".into()),
                sort_order: None,
            },
        )
        .expect("update project")
        .expect("updated project exists");
        assert_eq!(updated.theme.as_deref(), Some("胶片人像"));
        assert_eq!(updated.location.as_deref(), Some("公园"));

        assert!(delete_project(&connection, &created.id).expect("delete project"));
        assert!(get_project(&connection, &created.id)
            .expect("get deleted project")
            .is_none());
        assert!(!delete_project(&connection, &created.id).expect("delete missing project"));
    }

    #[test]
    fn project_sort_order_and_reorder_work() {
        let connection = test_connection();
        let first = create_project(
            &connection,
            &ProjectPayload {
                name: "项目 A".into(),
                theme: None,
                description: None,
                location: None,
                planned_shooting_time: None,
                notes: None,
                sort_order: None,
            },
        )
        .expect("create first project");
        let second = create_project(
            &connection,
            &ProjectPayload {
                name: "项目 B".into(),
                theme: None,
                description: None,
                location: None,
                planned_shooting_time: None,
                notes: None,
                sort_order: None,
            },
        )
        .expect("create second project");

        assert_eq!(first.sort_order, 0);
        assert_eq!(second.sort_order, 1);

        let reordered = reorder_projects(&connection, &[second.id.clone(), first.id.clone()])
            .expect("reorder projects");
        assert_eq!(
            reordered.iter().map(|project| project.id.as_str()).collect::<Vec<_>>(),
            vec![second.id.as_str(), first.id.as_str()]
        );

        let error = reorder_projects(&connection, &["missing-project".into()])
            .expect_err("missing project is rejected");
        assert!(matches!(error, rusqlite::Error::InvalidParameterName(_)));
    }
}
