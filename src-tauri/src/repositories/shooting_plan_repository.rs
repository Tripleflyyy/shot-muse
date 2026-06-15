use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{ShootingPlan, ShootingPlanFilters, ShootingPlanPayload};

pub fn create_shooting_plan(
    connection: &Connection,
    payload: &ShootingPlanPayload,
) -> rusqlite::Result<ShootingPlan> {
    let id = Uuid::new_v4().to_string();
    let status = normalize_optional_text(&payload.status).unwrap_or_else(|| "draft".to_string());

    connection.execute(
        "
        INSERT INTO shooting_plans (
          id,
          project_id,
          title,
          shooting_theme,
          gear_list,
          scene_list,
          action_list,
          composition_reference,
          lighting_reference,
          post_style,
          technique_notes,
          notes,
          status,
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
          ?12,
          ?13,
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        )
        ",
        params![
            id,
            payload.project_id.trim(),
            payload.title.trim(),
            normalize_optional_text(&payload.shooting_theme),
            normalize_optional_text(&payload.gear_list),
            normalize_optional_text(&payload.scene_list),
            normalize_optional_text(&payload.action_list),
            normalize_optional_text(&payload.composition_reference),
            normalize_optional_text(&payload.lighting_reference),
            normalize_optional_text(&payload.post_style),
            normalize_optional_text(&payload.technique_notes),
            normalize_optional_text(&payload.notes),
            status,
        ],
    )?;

    get_shooting_plan(connection, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn update_shooting_plan(
    connection: &Connection,
    id: &str,
    payload: &ShootingPlanPayload,
) -> rusqlite::Result<Option<ShootingPlan>> {
    let status = normalize_optional_text(&payload.status).unwrap_or_else(|| "draft".to_string());
    let updated_count = connection.execute(
        "
        UPDATE shooting_plans
        SET
          project_id = ?2,
          title = ?3,
          shooting_theme = ?4,
          gear_list = ?5,
          scene_list = ?6,
          action_list = ?7,
          composition_reference = ?8,
          lighting_reference = ?9,
          post_style = ?10,
          technique_notes = ?11,
          notes = ?12,
          status = ?13,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1
        ",
        params![
            id,
            payload.project_id.trim(),
            payload.title.trim(),
            normalize_optional_text(&payload.shooting_theme),
            normalize_optional_text(&payload.gear_list),
            normalize_optional_text(&payload.scene_list),
            normalize_optional_text(&payload.action_list),
            normalize_optional_text(&payload.composition_reference),
            normalize_optional_text(&payload.lighting_reference),
            normalize_optional_text(&payload.post_style),
            normalize_optional_text(&payload.technique_notes),
            normalize_optional_text(&payload.notes),
            status,
        ],
    )?;

    if updated_count == 0 {
        return Ok(None);
    }

    get_shooting_plan(connection, id)
}

pub fn delete_shooting_plan(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    let deleted_count = connection.execute("DELETE FROM shooting_plans WHERE id = ?1", [id])?;
    Ok(deleted_count > 0)
}

pub fn get_shooting_plan(
    connection: &Connection,
    id: &str,
) -> rusqlite::Result<Option<ShootingPlan>> {
    connection
        .query_row(
            "
            SELECT
              shooting_plans.id,
              shooting_plans.project_id,
              projects.name AS project_name,
              shooting_plans.title,
              shooting_plans.shooting_theme,
              shooting_plans.gear_list,
              shooting_plans.scene_list,
              shooting_plans.action_list,
              shooting_plans.composition_reference,
              shooting_plans.lighting_reference,
              shooting_plans.post_style,
              shooting_plans.technique_notes,
              shooting_plans.notes,
              shooting_plans.cover_media_asset_id,
              shooting_plans.status,
              shooting_plans.created_at,
              shooting_plans.updated_at
            FROM shooting_plans
            LEFT JOIN projects ON projects.id = shooting_plans.project_id
            WHERE shooting_plans.id = ?1
            ",
            [id],
            map_shooting_plan,
        )
        .optional()
}

pub fn list_shooting_plans(
    connection: &Connection,
    filters: &ShootingPlanFilters,
) -> rusqlite::Result<Vec<ShootingPlan>> {
    let mut statement = connection.prepare(
        "
        SELECT
          shooting_plans.id,
          shooting_plans.project_id,
          projects.name AS project_name,
          shooting_plans.title,
          shooting_plans.shooting_theme,
          shooting_plans.gear_list,
          shooting_plans.scene_list,
          shooting_plans.action_list,
          shooting_plans.composition_reference,
          shooting_plans.lighting_reference,
          shooting_plans.post_style,
          shooting_plans.technique_notes,
          shooting_plans.notes,
          shooting_plans.cover_media_asset_id,
          shooting_plans.status,
          shooting_plans.created_at,
          shooting_plans.updated_at
        FROM shooting_plans
        LEFT JOIN projects ON projects.id = shooting_plans.project_id
        ORDER BY shooting_plans.updated_at DESC, shooting_plans.created_at DESC
        ",
    )?;

    let plans = statement
        .query_map([], map_shooting_plan)?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let project_id = normalize_optional_text(&filters.project_id);
    let status = normalize_optional_text(&filters.status);
    let keyword = normalize_optional_text(&filters.keyword).map(|value| value.to_lowercase());

    Ok(plans
        .into_iter()
        .filter(|plan| {
            if let Some(project_id) = project_id.as_deref() {
                if plan.project_id != project_id {
                    return false;
                }
            }

            if let Some(status) = status.as_deref() {
                if plan.status != status {
                    return false;
                }
            }

            if let Some(keyword) = keyword.as_deref() {
                let haystack = [
                    Some(plan.title.as_str()),
                    plan.shooting_theme.as_deref(),
                    plan.gear_list.as_deref(),
                    plan.scene_list.as_deref(),
                    plan.action_list.as_deref(),
                    plan.notes.as_deref(),
                ]
                .into_iter()
                .flatten()
                .collect::<Vec<_>>()
                .join("\n")
                .to_lowercase();

                if !haystack.contains(keyword) {
                    return false;
                }
            }

            true
        })
        .collect())
}

pub fn list_shooting_plans_by_project(
    connection: &Connection,
    project_id: &str,
) -> rusqlite::Result<Vec<ShootingPlan>> {
    list_shooting_plans(
        connection,
        &ShootingPlanFilters {
            project_id: Some(project_id.to_string()),
            status: None,
            keyword: None,
        },
    )
}

pub fn update_shooting_plan_cover(
    connection: &Connection,
    id: &str,
    cover_media_asset_id: Option<String>,
) -> rusqlite::Result<Option<ShootingPlan>> {
    let updated_count = connection.execute(
        "
        UPDATE shooting_plans
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

    get_shooting_plan(connection, id)
}

pub fn media_asset_exists(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM media_assets WHERE id = ?1)",
        [id],
        |row| row.get::<_, i64>(0).map(|value| value == 1),
    )
}

pub fn shooting_plan_exists(connection: &Connection, id: &str) -> rusqlite::Result<bool> {
    connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM shooting_plans WHERE id = ?1)",
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

fn map_shooting_plan(row: &rusqlite::Row<'_>) -> rusqlite::Result<ShootingPlan> {
    Ok(ShootingPlan {
        id: row.get(0)?,
        project_id: row.get(1)?,
        project_name: row.get(2)?,
        title: row.get(3)?,
        shooting_theme: row.get(4)?,
        gear_list: row.get(5)?,
        scene_list: row.get(6)?,
        action_list: row.get(7)?,
        composition_reference: row.get(8)?,
        lighting_reference: row.get(9)?,
        post_style: row.get(10)?,
        technique_notes: row.get(11)?,
        notes: row.get(12)?,
        cover_media_asset_id: row.get(13)?,
        status: row.get(14)?,
        created_at: row.get(15)?,
        updated_at: row.get(16)?,
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
    use crate::models::ProjectPayload;
    use crate::repositories::project_repository;

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("open in-memory database");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        migrations::run_migrations(&connection).expect("run migrations");
        connection
    }

    fn create_project(connection: &Connection, name: &str) -> String {
        project_repository::create_project(
            connection,
            &ProjectPayload {
                name: name.into(),
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

    fn payload(project_id: &str, title: &str, status: Option<&str>) -> ShootingPlanPayload {
        ShootingPlanPayload {
            project_id: project_id.into(),
            title: title.into(),
            shooting_theme: Some("咖啡馆人像".into()),
            gear_list: Some("相机、35mm 镜头".into()),
            scene_list: Some("窗边座位".into()),
            action_list: Some("看向窗外".into()),
            composition_reference: Some("三分法".into()),
            lighting_reference: Some("窗边自然光".into()),
            post_style: Some("低饱和暖色".into()),
            technique_notes: Some("注意曝光补偿".into()),
            notes: Some("提前踩点".into()),
            status: status.map(ToOwned::to_owned),
        }
    }

    #[test]
    fn create_get_update_delete_shooting_plan() {
        let connection = test_connection();
        let project_id = create_project(&connection, "测试拍摄项目");

        let created = create_shooting_plan(
            &connection,
            &payload(&project_id, "咖啡馆人像拍摄计划", None),
        )
        .expect("create shooting plan");
        assert_eq!(created.status, "draft");
        assert_eq!(created.project_name.as_deref(), Some("测试拍摄项目"));
        assert!(created.cover_media_asset_id.is_none());

        let fetched = get_shooting_plan(&connection, &created.id)
            .expect("get shooting plan")
            .expect("shooting plan exists");
        assert_eq!(fetched.title, "咖啡馆人像拍摄计划");

        let updated = update_shooting_plan(
            &connection,
            &created.id,
            &payload(&project_id, "更新后的拍摄计划", Some("ready")),
        )
        .expect("update shooting plan")
        .expect("updated plan exists");
        assert_eq!(updated.title, "更新后的拍摄计划");
        assert_eq!(updated.status, "ready");

        assert!(delete_shooting_plan(&connection, &created.id).expect("delete shooting plan"));
        assert!(get_shooting_plan(&connection, &created.id)
            .expect("get deleted shooting plan")
            .is_none());
    }

    #[test]
    fn update_shooting_plan_cover_is_returned_by_get_and_list() {
        let connection = test_connection();
        let project_id = create_project(&connection, "封面测试项目");
        let created =
            create_shooting_plan(&connection, &payload(&project_id, "封面测试计划", None))
                .expect("create shooting plan");
        let media_id = "media-cover-id";

        connection
            .execute(
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
                  'inspiration',
                  'inspiration-id',
                  '/media/inspiration/test.jpg',
                  'test.jpg',
                  'image/jpeg',
                  1024,
                  800,
                  600,
                  'file_picker',
                  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                )
                ",
                [media_id],
            )
            .expect("insert media asset");

        let updated = update_shooting_plan_cover(&connection, &created.id, Some(media_id.into()))
            .expect("update cover")
            .expect("updated plan exists");
        assert_eq!(updated.cover_media_asset_id.as_deref(), Some(media_id));

        let fetched = get_shooting_plan(&connection, &created.id)
            .expect("get plan")
            .expect("plan exists");
        assert_eq!(fetched.cover_media_asset_id.as_deref(), Some(media_id));

        let listed = list_shooting_plans(&connection, &ShootingPlanFilters {
            project_id: Some(project_id),
            status: None,
            keyword: None,
        })
        .expect("list plans");
        assert_eq!(listed[0].cover_media_asset_id.as_deref(), Some(media_id));
    }

    #[test]
    fn list_shooting_plans_filters_by_project_status_and_keyword() {
        let connection = test_connection();
        let first_project_id = create_project(&connection, "项目 A");
        let second_project_id = create_project(&connection, "项目 B");

        let first = create_shooting_plan(
            &connection,
            &payload(&first_project_id, "咖啡馆人像拍摄计划", Some("ready")),
        )
        .expect("create first plan");
        let _second = create_shooting_plan(
            &connection,
            &payload(&second_project_id, "夜景街拍计划", Some("draft")),
        )
        .expect("create second plan");

        let by_project = list_shooting_plans_by_project(&connection, &first_project_id)
            .expect("list by project");
        assert_eq!(by_project.len(), 1);
        assert_eq!(by_project[0].id, first.id);

        let by_status = list_shooting_plans(
            &connection,
            &ShootingPlanFilters {
                project_id: None,
                status: Some("ready".into()),
                keyword: None,
            },
        )
        .expect("list by status");
        assert_eq!(by_status.len(), 1);
        assert_eq!(by_status[0].id, first.id);

        let by_keyword = list_shooting_plans(
            &connection,
            &ShootingPlanFilters {
                project_id: None,
                status: None,
                keyword: Some("35mm".into()),
            },
        )
        .expect("list by keyword");
        assert_eq!(by_keyword.len(), 2);
    }

    #[test]
    fn deleting_project_cascades_shooting_plans() {
        let connection = test_connection();
        let project_id = create_project(&connection, "待删除项目");
        let created =
            create_shooting_plan(&connection, &payload(&project_id, "会被级联删除", None))
                .expect("create shooting plan");

        assert!(
            project_repository::delete_project(&connection, &project_id).expect("delete project")
        );
        assert!(get_shooting_plan(&connection, &created.id)
            .expect("get deleted plan")
            .is_none());
    }
}
