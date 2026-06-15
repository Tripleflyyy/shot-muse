use tauri::State;

use crate::models::{ShootingPlan, ShootingPlanFilters, ShootingPlanPayload};
use crate::repositories::shooting_plan_repository;
use crate::state::AppState;

const VALID_PLAN_STATUSES: &[&str] = &["draft", "ready", "completed", "archived"];

#[tauri::command]
pub fn create_shooting_plan(
    state: State<'_, AppState>,
    payload: ShootingPlanPayload,
) -> Result<ShootingPlan, String> {
    validate_payload_shape(&payload)?;

    state
        .with_connection(|connection| {
            validate_payload_references(connection, &payload)?;
            shooting_plan_repository::create_shooting_plan(connection, &normalize_payload(payload))
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn update_shooting_plan(
    state: State<'_, AppState>,
    id: String,
    payload: ShootingPlanPayload,
) -> Result<ShootingPlan, String> {
    validate_id(&id, "拍摄计划 ID 不能为空")?;
    validate_payload_shape(&payload)?;

    state
        .with_connection(|connection| {
            if !shooting_plan_repository::shooting_plan_exists(connection, &id)? {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }

            validate_payload_references(connection, &payload)?;
            shooting_plan_repository::update_shooting_plan(
                connection,
                &id,
                &normalize_payload(payload),
            )?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn delete_shooting_plan(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    validate_id(&id, "拍摄计划 ID 不能为空")?;

    state
        .with_connection(|connection| {
            let deleted = shooting_plan_repository::delete_shooting_plan(connection, &id)?;
            if deleted {
                Ok(true)
            } else {
                Err(rusqlite::Error::QueryReturnedNoRows)
            }
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn get_shooting_plan(state: State<'_, AppState>, id: String) -> Result<ShootingPlan, String> {
    validate_id(&id, "拍摄计划 ID 不能为空")?;

    state
        .with_connection(|connection| shooting_plan_repository::get_shooting_plan(connection, &id))
        .map_err(command_error)?
        .ok_or_else(|| "拍摄计划不存在".to_string())
}

#[tauri::command]
pub fn list_shooting_plans(
    state: State<'_, AppState>,
    filters: Option<ShootingPlanFilters>,
) -> Result<Vec<ShootingPlan>, String> {
    let filters = normalize_filters(filters.unwrap_or(ShootingPlanFilters {
        project_id: None,
        status: None,
        keyword: None,
    }));

    if let Some(status) = filters.status.as_deref() {
        validate_status(status)?;
    }

    state
        .with_connection(|connection| {
            validate_filter_references(connection, &filters)?;
            shooting_plan_repository::list_shooting_plans(connection, &filters)
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn list_shooting_plans_by_project(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<ShootingPlan>, String> {
    validate_id(&project_id, "关联项目不能为空")?;

    state
        .with_connection(|connection| {
            ensure_project_exists(connection, &project_id)?;
            shooting_plan_repository::list_shooting_plans_by_project(connection, &project_id)
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn update_shooting_plan_cover(
    state: State<'_, AppState>,
    id: String,
    cover_media_asset_id: Option<String>,
) -> Result<ShootingPlan, String> {
    validate_id(&id, "拍摄计划 ID 不能为空")?;
    let cover_media_asset_id = normalize_optional_string(cover_media_asset_id);

    state
        .with_connection(|connection| {
            if !shooting_plan_repository::shooting_plan_exists(connection, &id)? {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }

            if let Some(media_asset_id) = cover_media_asset_id.as_deref() {
                if !shooting_plan_repository::media_asset_exists(connection, media_asset_id)? {
                    return Err(validation_error("封面图片不存在"));
                }
            }

            shooting_plan_repository::update_shooting_plan_cover(
                connection,
                &id,
                cover_media_asset_id,
            )?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
        })
        .map_err(command_error)
}

fn validate_payload_shape(payload: &ShootingPlanPayload) -> Result<(), String> {
    if payload.project_id.trim().is_empty() {
        return Err("关联项目不能为空".to_string());
    }

    if payload.title.trim().is_empty() {
        return Err("拍摄计划标题不能为空".to_string());
    }

    let status = payload.status.as_deref().unwrap_or("draft").trim();
    validate_status(status)?;
    Ok(())
}

fn validate_payload_references(
    connection: &rusqlite::Connection,
    payload: &ShootingPlanPayload,
) -> rusqlite::Result<()> {
    ensure_project_exists(connection, payload.project_id.trim())
}

fn validate_filter_references(
    connection: &rusqlite::Connection,
    filters: &ShootingPlanFilters,
) -> rusqlite::Result<()> {
    if let Some(project_id) = filters.project_id.as_deref() {
        ensure_project_exists(connection, project_id)?;
    }

    Ok(())
}

fn ensure_project_exists(connection: &rusqlite::Connection, id: &str) -> rusqlite::Result<()> {
    if shooting_plan_repository::project_exists(connection, id)? {
        Ok(())
    } else {
        Err(validation_error("关联项目不存在"))
    }
}

fn validate_status(status: &str) -> Result<(), String> {
    if VALID_PLAN_STATUSES.contains(&status) {
        Ok(())
    } else {
        Err("拍摄计划状态不支持".to_string())
    }
}

fn normalize_payload(payload: ShootingPlanPayload) -> ShootingPlanPayload {
    ShootingPlanPayload {
        project_id: payload.project_id.trim().to_string(),
        title: payload.title.trim().to_string(),
        shooting_theme: normalize_optional_string(payload.shooting_theme),
        gear_list: normalize_optional_string(payload.gear_list),
        scene_list: normalize_optional_string(payload.scene_list),
        action_list: normalize_optional_string(payload.action_list),
        composition_reference: normalize_optional_string(payload.composition_reference),
        lighting_reference: normalize_optional_string(payload.lighting_reference),
        post_style: normalize_optional_string(payload.post_style),
        technique_notes: normalize_optional_string(payload.technique_notes),
        notes: normalize_optional_string(payload.notes),
        status: normalize_optional_string(payload.status).or_else(|| Some("draft".to_string())),
    }
}

fn normalize_filters(filters: ShootingPlanFilters) -> ShootingPlanFilters {
    ShootingPlanFilters {
        project_id: normalize_optional_string(filters.project_id),
        status: normalize_optional_string(filters.status),
        keyword: normalize_optional_string(filters.keyword),
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn validate_id(id: &str, message: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err(message.to_string());
    }

    Ok(())
}

fn command_error(error: rusqlite::Error) -> String {
    match error {
        rusqlite::Error::QueryReturnedNoRows => "拍摄计划不存在".to_string(),
        rusqlite::Error::InvalidParameterName(message) => message,
        other => format!("数据库操作失败：{other}"),
    }
}

fn validation_error(message: &str) -> rusqlite::Error {
    rusqlite::Error::InvalidParameterName(message.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

    fn test_connection() -> rusqlite::Connection {
        let connection = rusqlite::Connection::open_in_memory().expect("open in-memory database");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        migrations::run_migrations(&connection).expect("run migrations");
        connection
    }

    fn payload(project_id: &str, title: &str, status: Option<&str>) -> ShootingPlanPayload {
        ShootingPlanPayload {
            project_id: project_id.into(),
            title: title.into(),
            shooting_theme: None,
            gear_list: None,
            scene_list: None,
            action_list: None,
            composition_reference: None,
            lighting_reference: None,
            post_style: None,
            technique_notes: None,
            notes: None,
            status: status.map(ToOwned::to_owned),
        }
    }

    #[test]
    fn validation_rejects_empty_title_and_invalid_status() {
        assert_eq!(
            validate_payload_shape(&payload("project-id", "", None)).expect_err("empty title"),
            "拍摄计划标题不能为空"
        );
        assert_eq!(
            validate_payload_shape(&payload("project-id", "测试计划", Some("invalid")))
                .expect_err("invalid status"),
            "拍摄计划状态不支持"
        );
    }

    #[test]
    fn validation_rejects_missing_project() {
        let connection = test_connection();
        let error = validate_payload_references(
            &connection,
            &payload("missing-project", "测试计划", Some("draft")),
        )
        .expect_err("missing project");

        assert_eq!(command_error(error), "关联项目不存在");
    }
}
