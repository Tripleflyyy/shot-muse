use tauri::State;

use crate::models::{InspirationCard, InspirationCardFilters, InspirationCardPayload};
use crate::repositories::{inspiration_repository, media_repository};
use crate::state::AppState;

const VALID_SOURCE_PLATFORMS: &[&str] = &[
    "douyin",
    "xiaohongshu",
    "bilibili",
    "youtube",
    "instagram",
    "other",
];

const VALID_CARD_TYPES: &[&str] = &["inspiration", "technique"];

#[tauri::command]
pub fn create_inspiration_card(
    state: State<'_, AppState>,
    payload: InspirationCardPayload,
) -> Result<InspirationCard, String> {
    validate_payload_shape(&payload)?;

    state
        .with_connection(|connection| {
            validate_payload_references(connection, &payload)?;
            inspiration_repository::create_inspiration_card(connection, &normalize_payload(payload))
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn update_inspiration_card(
    state: State<'_, AppState>,
    id: String,
    payload: InspirationCardPayload,
) -> Result<InspirationCard, String> {
    validate_id(&id, "灵感卡片 ID 不能为空")?;
    validate_payload_shape(&payload)?;

    state
        .with_connection(|connection| {
            if !inspiration_repository::inspiration_exists(connection, &id)? {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }

            validate_payload_references(connection, &payload)?;
            inspiration_repository::update_inspiration_card(
                connection,
                &id,
                &normalize_payload(payload),
            )?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn delete_inspiration_card(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    validate_id(&id, "灵感卡片 ID 不能为空")?;

    state
        .with_connection(|connection| {
            let deleted = inspiration_repository::delete_inspiration_card(connection, &id)?;
            if deleted {
                Ok(true)
            } else {
                Err(rusqlite::Error::QueryReturnedNoRows)
            }
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn get_inspiration_card(
    state: State<'_, AppState>,
    id: String,
) -> Result<InspirationCard, String> {
    validate_id(&id, "灵感卡片 ID 不能为空")?;

    state
        .with_connection(|connection| inspiration_repository::get_inspiration_card(connection, &id))
        .map_err(command_error)?
        .ok_or_else(|| "未找到灵感卡片".to_string())
}

#[tauri::command]
pub fn list_inspiration_cards(
    state: State<'_, AppState>,
    filters: Option<InspirationCardFilters>,
) -> Result<Vec<InspirationCard>, String> {
    let filters = normalize_filters(filters.unwrap_or(InspirationCardFilters {
        card_type: None,
        project_id: None,
        source_platform: None,
        keyword: None,
        tag_ids: None,
    }));

    if let Some(source_platform) = filters.source_platform.as_deref() {
        validate_source_platform(source_platform)?;
    }

    if let Some(card_type) = filters.card_type.as_deref() {
        validate_card_type_filter(card_type)?;
    }

    state
        .with_connection(|connection| {
            validate_filter_references(connection, &filters)?;
            inspiration_repository::list_inspiration_cards(connection, &filters)
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn attach_tag_to_inspiration(
    state: State<'_, AppState>,
    inspiration_card_id: String,
    tag_id: String,
) -> Result<bool, String> {
    validate_id(&inspiration_card_id, "灵感卡片 ID 不能为空")?;
    validate_id(&tag_id, "标签 ID 不能为空")?;

    state
        .with_connection(|connection| {
            ensure_inspiration_exists(connection, &inspiration_card_id)?;
            ensure_tag_exists(connection, &tag_id)?;
            inspiration_repository::attach_tag_to_inspiration(
                connection,
                &inspiration_card_id,
                &tag_id,
            )
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn detach_tag_from_inspiration(
    state: State<'_, AppState>,
    inspiration_card_id: String,
    tag_id: String,
) -> Result<bool, String> {
    validate_id(&inspiration_card_id, "灵感卡片 ID 不能为空")?;
    validate_id(&tag_id, "标签 ID 不能为空")?;

    state
        .with_connection(|connection| {
            ensure_inspiration_exists(connection, &inspiration_card_id)?;
            ensure_tag_exists(connection, &tag_id)?;
            inspiration_repository::detach_tag_from_inspiration(
                connection,
                &inspiration_card_id,
                &tag_id,
            )
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn attach_inspiration_to_project(
    state: State<'_, AppState>,
    project_id: String,
    inspiration_card_id: String,
) -> Result<bool, String> {
    validate_id(&project_id, "项目 ID 不能为空")?;
    validate_id(&inspiration_card_id, "灵感卡片 ID 不能为空")?;

    state
        .with_connection(|connection| {
            ensure_project_exists(connection, &project_id)?;
            ensure_inspiration_exists(connection, &inspiration_card_id)?;
            inspiration_repository::attach_inspiration_to_project(
                connection,
                &project_id,
                &inspiration_card_id,
            )
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn detach_inspiration_from_project(
    state: State<'_, AppState>,
    project_id: String,
    inspiration_card_id: String,
) -> Result<bool, String> {
    validate_id(&project_id, "项目 ID 不能为空")?;
    validate_id(&inspiration_card_id, "灵感卡片 ID 不能为空")?;

    state
        .with_connection(|connection| {
            ensure_project_exists(connection, &project_id)?;
            ensure_inspiration_exists(connection, &inspiration_card_id)?;
            inspiration_repository::detach_inspiration_from_project(
                connection,
                &project_id,
                &inspiration_card_id,
            )
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn list_project_inspirations(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<InspirationCard>, String> {
    validate_id(&project_id, "项目 ID 不能为空")?;

    state
        .with_connection(|connection| {
            ensure_project_exists(connection, &project_id)?;
            inspiration_repository::list_project_inspirations(connection, &project_id)
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn update_inspiration_card_cover(
    state: State<'_, AppState>,
    card_id: String,
    media_asset_id: Option<String>,
) -> Result<InspirationCard, String> {
    validate_id(&card_id, "卡片 ID 不能为空")?;

    state
        .with_connection(|connection| {
            ensure_inspiration_exists(connection, &card_id)?;

            let normalized_media_asset_id = normalize_optional_string(media_asset_id);
            if let Some(media_asset_id) = normalized_media_asset_id.as_deref() {
                let media_asset = media_repository::get_media_asset(connection, media_asset_id)?
                    .ok_or_else(|| validation_error("图片不存在"))?;

                if media_asset.target_type != "inspiration"
                    || media_asset.target_id.as_deref() != Some(card_id.trim())
                {
                    return Err(validation_error("该图片不属于当前卡片"));
                }
            }

            inspiration_repository::update_inspiration_card_cover(
                connection,
                card_id.trim(),
                normalized_media_asset_id,
            )?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
        })
        .map_err(command_error)
}

fn validate_payload_shape(payload: &InspirationCardPayload) -> Result<(), String> {
    if payload.title.trim().is_empty() {
        return Err("灵感标题不能为空".to_string());
    }

    if payload.source_platform.trim().is_empty() {
        return Err("来源平台不能为空".to_string());
    }

    validate_source_platform(payload.source_platform.trim())?;
    validate_card_type(payload.card_type.as_deref().unwrap_or("inspiration").trim())?;
    Ok(())
}

fn validate_payload_references(
    connection: &rusqlite::Connection,
    payload: &InspirationCardPayload,
) -> rusqlite::Result<()> {
    if let Some(project_id) = normalize_optional_string(payload.project_id.clone()) {
        if !inspiration_repository::project_exists(connection, &project_id)? {
            return Err(validation_error("关联项目不存在"));
        }
    }

    for tag_id in normalized_ids(payload.tag_ids.as_deref().unwrap_or(&[])) {
        if !inspiration_repository::tag_exists(connection, &tag_id)? {
            return Err(validation_error("标签不存在"));
        }
    }

    Ok(())
}

fn validate_filter_references(
    connection: &rusqlite::Connection,
    filters: &InspirationCardFilters,
) -> rusqlite::Result<()> {
    if let Some(project_id) = filters.project_id.as_deref() {
        if !inspiration_repository::project_exists(connection, project_id)? {
            return Err(validation_error("关联项目不存在"));
        }
    }

    for tag_id in filters.tag_ids.as_deref().unwrap_or(&[]) {
        if !inspiration_repository::tag_exists(connection, tag_id)? {
            return Err(validation_error("标签不存在"));
        }
    }

    Ok(())
}

fn ensure_inspiration_exists(connection: &rusqlite::Connection, id: &str) -> rusqlite::Result<()> {
    if inspiration_repository::inspiration_exists(connection, id)? {
        Ok(())
    } else {
        Err(rusqlite::Error::QueryReturnedNoRows)
    }
}

fn ensure_tag_exists(connection: &rusqlite::Connection, id: &str) -> rusqlite::Result<()> {
    if inspiration_repository::tag_exists(connection, id)? {
        Ok(())
    } else {
        Err(validation_error("标签不存在"))
    }
}

fn ensure_project_exists(connection: &rusqlite::Connection, id: &str) -> rusqlite::Result<()> {
    if inspiration_repository::project_exists(connection, id)? {
        Ok(())
    } else {
        Err(validation_error("关联项目不存在"))
    }
}

fn validate_source_platform(source_platform: &str) -> Result<(), String> {
    if VALID_SOURCE_PLATFORMS.contains(&source_platform) {
        Ok(())
    } else {
        Err("来源平台不支持".to_string())
    }
}

fn validate_card_type(card_type: &str) -> Result<(), String> {
    if VALID_CARD_TYPES.contains(&card_type) {
        Ok(())
    } else {
        Err("卡片类型不合法".to_string())
    }
}

fn validate_card_type_filter(card_type: &str) -> Result<(), String> {
    if card_type == "all" {
        Ok(())
    } else {
        validate_card_type(card_type)
    }
}

fn normalize_payload(payload: InspirationCardPayload) -> InspirationCardPayload {
    InspirationCardPayload {
        card_type: Some(normalize_card_type(payload.card_type)),
        title: payload.title.trim().to_string(),
        source_platform: payload.source_platform.trim().to_string(),
        source_url: normalize_optional_string(payload.source_url),
        author_name: normalize_optional_string(payload.author_name),
        notes: normalize_optional_string(payload.notes),
        project_id: normalize_optional_string(payload.project_id),
        collected_at: normalize_optional_string(payload.collected_at),
        tag_ids: Some(normalized_ids(payload.tag_ids.as_deref().unwrap_or(&[]))),
    }
}

fn normalize_filters(filters: InspirationCardFilters) -> InspirationCardFilters {
    InspirationCardFilters {
        card_type: normalize_card_type_filter(filters.card_type),
        project_id: normalize_optional_string(filters.project_id),
        source_platform: normalize_optional_string(filters.source_platform),
        keyword: normalize_optional_string(filters.keyword),
        tag_ids: Some(normalized_ids(filters.tag_ids.as_deref().unwrap_or(&[]))),
    }
}

fn normalize_card_type(value: Option<String>) -> String {
    normalize_optional_string(value).unwrap_or_else(|| "inspiration".to_string())
}

fn normalize_card_type_filter(value: Option<String>) -> Option<String> {
    match normalize_optional_string(value) {
        Some(value) if value == "all" => None,
        value => value,
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
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

fn validate_id(id: &str, message: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err(message.to_string());
    }

    Ok(())
}

fn command_error(error: rusqlite::Error) -> String {
    match error {
        rusqlite::Error::QueryReturnedNoRows => "未找到灵感卡片".to_string(),
        rusqlite::Error::InvalidParameterName(message) => message,
        other => database_error(other),
    }
}

fn database_error(error: rusqlite::Error) -> String {
    format!("数据库操作失败：{error}")
}

fn validation_error(message: &str) -> rusqlite::Error {
    rusqlite::Error::InvalidParameterName(message.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_payload() -> InspirationCardPayload {
        InspirationCardPayload {
            card_type: Some("inspiration".into()),
            title: "测试卡片".into(),
            source_platform: "xiaohongshu".into(),
            source_url: None,
            author_name: None,
            notes: None,
            project_id: None,
            collected_at: None,
            tag_ids: Some(vec![]),
        }
    }

    #[test]
    fn validation_rejects_invalid_card_type() {
        let mut payload = valid_payload();
        payload.card_type = Some("reference".into());

        assert_eq!(
            validate_payload_shape(&payload),
            Err("卡片类型不合法".to_string())
        );
    }
}
