use tauri::State;

use crate::models::{
    MediaAsset, MediaAssetFilters, MediaAssetPayload, UpdateMediaAssetTargetPayload,
};
use crate::repositories::media_repository;
use crate::state::AppState;

const VALID_TARGET_TYPES: &[&str] = &["inspiration", "technique", "project", "plan"];
const VALID_SOURCE_TYPES: &[&str] = &["file_picker", "clipboard", "drag_drop"];

#[tauri::command]
pub fn create_media_asset(
    state: State<'_, AppState>,
    payload: MediaAssetPayload,
) -> Result<MediaAsset, String> {
    validate_media_asset_payload(&payload)?;

    state
        .with_connection(|connection| {
            media_repository::create_media_asset(connection, &normalize_payload(payload))
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn get_media_asset(state: State<'_, AppState>, id: String) -> Result<MediaAsset, String> {
    validate_id(&id)?;

    state
        .with_connection(|connection| media_repository::get_media_asset(connection, id.trim()))
        .map_err(command_error)?
        .ok_or_else(|| "媒体资源不存在".to_string())
}

#[tauri::command]
pub fn list_media_assets(
    state: State<'_, AppState>,
    filters: Option<MediaAssetFilters>,
) -> Result<Vec<MediaAsset>, String> {
    let filters = normalize_filters(filters.unwrap_or(MediaAssetFilters {
        target_type: None,
        target_id: None,
        source_type: None,
    }));

    if let Some(target_type) = filters.target_type.as_deref() {
        validate_target_type(target_type)?;
    }

    if let Some(source_type) = filters.source_type.as_deref() {
        validate_source_type(source_type)?;
    }

    state
        .with_connection(|connection| media_repository::list_media_assets(connection, &filters))
        .map_err(command_error)
}

#[tauri::command]
pub fn list_media_assets_by_target(
    state: State<'_, AppState>,
    target_type: String,
    target_id: String,
) -> Result<Vec<MediaAsset>, String> {
    validate_target_type(&target_type)?;
    if target_id.trim().is_empty() {
        return Err("目标 ID 不能为空".to_string());
    }

    state
        .with_connection(|connection| {
            media_repository::list_media_assets_by_target(
                connection,
                target_type.trim(),
                target_id.trim(),
            )
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn update_media_asset_target(
    state: State<'_, AppState>,
    id: String,
    payload: UpdateMediaAssetTargetPayload,
) -> Result<MediaAsset, String> {
    validate_id(&id)?;
    validate_target_type(&payload.target_type)?;

    state
        .with_connection(|connection| {
            media_repository::update_media_asset_target(
                connection,
                id.trim(),
                payload.target_type.trim(),
                normalize_optional_string(payload.target_id),
            )?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn delete_media_asset(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    validate_id(&id)?;

    state
        .with_connection(|connection| {
            let deleted = media_repository::delete_media_asset(connection, id.trim())?;
            if deleted {
                Ok(true)
            } else {
                Err(rusqlite::Error::QueryReturnedNoRows)
            }
        })
        .map_err(command_error)
}

pub(crate) fn validate_media_asset_payload(payload: &MediaAssetPayload) -> Result<(), String> {
    validate_target_type(&payload.target_type)?;

    if payload.file_path.trim().is_empty() {
        return Err("文件路径不能为空".to_string());
    }

    validate_source_type(&payload.source_type)?;
    Ok(())
}

pub(crate) fn validate_target_type(target_type: &str) -> Result<(), String> {
    let value = target_type.trim();
    if value.is_empty() {
        return Err("目标类型不能为空".to_string());
    }

    if VALID_TARGET_TYPES.contains(&value) {
        Ok(())
    } else {
        Err("目标类型不支持".to_string())
    }
}

pub(crate) fn validate_source_type(source_type: &str) -> Result<(), String> {
    let value = source_type.trim();
    if value.is_empty() {
        return Err("来源类型不能为空".to_string());
    }

    if VALID_SOURCE_TYPES.contains(&value) {
        Ok(())
    } else {
        Err("来源类型不支持".to_string())
    }
}

fn validate_id(id: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("媒体资源 ID 不能为空".to_string());
    }

    Ok(())
}

fn normalize_payload(payload: MediaAssetPayload) -> MediaAssetPayload {
    MediaAssetPayload {
        target_type: payload.target_type.trim().to_string(),
        target_id: normalize_optional_string(payload.target_id),
        file_path: payload.file_path.trim().to_string(),
        original_filename: normalize_optional_string(payload.original_filename),
        mime_type: normalize_optional_string(payload.mime_type),
        file_size: payload.file_size,
        width: payload.width,
        height: payload.height,
        source_type: payload.source_type.trim().to_string(),
    }
}

fn normalize_filters(filters: MediaAssetFilters) -> MediaAssetFilters {
    MediaAssetFilters {
        target_type: normalize_optional_string(filters.target_type),
        target_id: normalize_optional_string(filters.target_id),
        source_type: normalize_optional_string(filters.source_type),
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn command_error(error: rusqlite::Error) -> String {
    match error {
        rusqlite::Error::QueryReturnedNoRows => "媒体资源不存在".to_string(),
        rusqlite::Error::InvalidParameterName(message) => message,
        other => format!("数据库操作失败：{other}"),
    }
}
