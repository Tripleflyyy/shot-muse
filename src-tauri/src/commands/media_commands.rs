use std::path::Path;

use tauri::State;

use crate::media::file_store;
use crate::models::{
    MediaAsset, MediaAssetFilters, MediaAssetPayload, UpdateMediaAssetTargetPayload,
};
use crate::repositories::{inspiration_repository, media_repository};
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

#[tauri::command]
pub fn import_local_image(
    state: State<'_, AppState>,
    source_path: String,
    target_type: String,
    target_id: String,
) -> Result<MediaAsset, String> {
    import_local_image_with_paths(
        &state,
        Path::new(source_path.trim()),
        target_type.trim(),
        target_id.trim(),
    )
}

fn import_local_image_with_paths(
    state: &AppState,
    source_path: &Path,
    target_type: &str,
    target_id: &str,
) -> Result<MediaAsset, String> {
    if source_path.as_os_str().is_empty() {
        return Err("源图片路径不能为空".to_string());
    }

    validate_target_type(target_type)?;

    if target_id.trim().is_empty() {
        return Err("目标 ID 不能为空".to_string());
    }

    if target_type != "inspiration" {
        return Err("本阶段仅支持为灵感卡片导入图片".to_string());
    }

    state
        .with_connection(|connection| {
            if !inspiration_repository::inspiration_exists(connection, target_id)? {
                return Err(validation_error("关联灵感卡片不存在"));
            }
            Ok(())
        })
        .map_err(command_error)?;

    let stored_file =
        file_store::copy_local_image(state.app_data_dir(), source_path, target_type, target_id)?;

    let payload = MediaAssetPayload {
        target_type: target_type.to_string(),
        target_id: Some(target_id.to_string()),
        file_path: stored_file.file_path,
        original_filename: stored_file.original_filename,
        mime_type: stored_file.mime_type,
        file_size: stored_file.file_size,
        width: None,
        height: None,
        source_type: "file_picker".to_string(),
    };

    state
        .with_connection(|connection| media_repository::create_media_asset(connection, &payload))
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

fn validation_error(message: &str) -> rusqlite::Error {
    rusqlite::Error::InvalidParameterName(message.to_string())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use crate::db::migrations;
    use crate::models::InspirationCardPayload;
    use crate::repositories::inspiration_repository;

    fn test_app_state() -> AppState {
        let app_data_dir = temp_dir("shot-muse-media-import-test");
        let state = AppState::initialize(&app_data_dir).expect("initialize app state");
        state
            .with_connection(|connection| {
                migrations::seed_default_tags(connection)?;
                Ok(())
            })
            .expect("seed tags");
        state
    }

    fn create_inspiration(state: &AppState) -> String {
        state
            .with_connection(|connection| {
                inspiration_repository::create_inspiration_card(
                    connection,
                    &InspirationCardPayload {
                        title: "测试图片灵感".into(),
                        source_platform: "xiaohongshu".into(),
                        source_url: None,
                        author_name: None,
                        notes: None,
                        project_id: None,
                        collected_at: None,
                        tag_ids: Some(vec![]),
                    },
                )
            })
            .expect("create inspiration")
            .id
    }

    fn write_fake_image(path: &Path) {
        fs::write(path, [0xff, 0xd8, 0xff, 0xd9]).expect("write fake image");
    }

    #[test]
    fn import_local_image_creates_media_asset_record() {
        let state = test_app_state();
        let inspiration_id = create_inspiration(&state);
        let source_dir = temp_dir("shot-muse-source-image-test");
        let source_path = source_dir.join("test.jpg");
        write_fake_image(&source_path);

        let imported =
            import_local_image_with_paths(&state, &source_path, "inspiration", &inspiration_id)
                .expect("import local image");

        assert_eq!(imported.target_type, "inspiration");
        assert_eq!(imported.target_id.as_deref(), Some(inspiration_id.as_str()));
        assert_eq!(imported.original_filename.as_deref(), Some("test.jpg"));
        assert_eq!(imported.mime_type.as_deref(), Some("image/jpeg"));
        assert_eq!(imported.source_type, "file_picker");
        assert!(Path::new(&imported.file_path).exists());
        assert_ne!(imported.file_path, source_path.to_string_lossy());
        assert!(imported
            .file_path
            .contains(&format!("media/inspiration/{inspiration_id}")));

        let linked = state
            .with_connection(|connection| {
                media_repository::list_media_assets_by_target(
                    connection,
                    "inspiration",
                    &inspiration_id,
                )
            })
            .expect("list imported images");
        assert_eq!(linked.len(), 1);
        assert_eq!(linked[0].id, imported.id);

        assert!(delete_media_asset_for_test(&state, &imported.id).expect("delete media asset"));
        assert!(Path::new(&imported.file_path).exists());
    }

    #[test]
    fn import_local_image_rejects_invalid_source_path_and_format() {
        let state = test_app_state();
        let inspiration_id = create_inspiration(&state);

        assert!(import_local_image_with_paths(
            &state,
            Path::new(""),
            "inspiration",
            &inspiration_id,
        )
        .is_err());

        assert!(import_local_image_with_paths(
            &state,
            Path::new("/tmp/shot-muse-missing-file.jpg"),
            "inspiration",
            &inspiration_id,
        )
        .is_err());

        let source_dir = temp_dir("shot-muse-unsupported-image-test");
        let source_path = source_dir.join("test.gif");
        fs::write(&source_path, b"gif").expect("write unsupported image");

        assert!(import_local_image_with_paths(
            &state,
            &source_path,
            "inspiration",
            &inspiration_id,
        )
        .is_err());
    }

    fn delete_media_asset_for_test(state: &AppState, id: &str) -> rusqlite::Result<bool> {
        state.with_connection(|connection| media_repository::delete_media_asset(connection, id))
    }

    fn temp_dir(prefix: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "{}-{}",
            prefix,
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock before unix epoch")
                .as_nanos()
        ));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }
}
