use tauri::State;

use crate::models::{Project, ProjectPayload};
use crate::repositories::project_repository;
use crate::state::AppState;

#[tauri::command]
pub fn create_project(
    state: State<'_, AppState>,
    payload: ProjectPayload,
) -> Result<Project, String> {
    validate_project_payload(&payload)?;

    state
        .with_connection(|connection| project_repository::create_project(connection, &payload))
        .map_err(database_error)
}

#[tauri::command]
pub fn update_project(
    state: State<'_, AppState>,
    id: String,
    payload: ProjectPayload,
) -> Result<Project, String> {
    validate_id(&id, "项目 ID 不能为空")?;
    validate_project_payload(&payload)?;

    state
        .with_connection(|connection| project_repository::update_project(connection, &id, &payload))
        .map_err(database_error)?
        .ok_or_else(|| "未找到要更新的摄影项目".to_string())
}

#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    validate_id(&id, "项目 ID 不能为空")?;

    let deleted = state
        .with_connection(|connection| project_repository::delete_project(connection, &id))
        .map_err(database_error)?;

    if deleted {
        Ok(true)
    } else {
        Err("未找到要删除的摄影项目".to_string())
    }
}

#[tauri::command]
pub fn get_project(state: State<'_, AppState>, id: String) -> Result<Project, String> {
    validate_id(&id, "项目 ID 不能为空")?;

    state
        .with_connection(|connection| project_repository::get_project(connection, &id))
        .map_err(database_error)?
        .ok_or_else(|| "未找到摄影项目".to_string())
}

#[tauri::command]
pub fn list_projects(
    state: State<'_, AppState>,
    keyword: Option<String>,
) -> Result<Vec<Project>, String> {
    state
        .with_connection(|connection| {
            project_repository::list_projects(connection, keyword.as_deref())
        })
        .map_err(database_error)
}

fn validate_project_payload(payload: &ProjectPayload) -> Result<(), String> {
    if payload.name.trim().is_empty() {
        return Err("项目名称不能为空".to_string());
    }

    Ok(())
}

fn validate_id(id: &str, message: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err(message.to_string());
    }

    Ok(())
}

fn database_error(error: rusqlite::Error) -> String {
    format!("数据库操作失败：{error}")
}
