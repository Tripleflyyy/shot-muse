use tauri::State;

use crate::models::{CreateTagPayload, Tag, TagUsage, UpdateTagPayload};
use crate::repositories::tag_repository;
use crate::state::AppState;

const VALID_TAG_CATEGORIES: &[&str] = &[
    "subject",
    "lighting",
    "composition",
    "color",
    "mood",
    "technique",
    "custom",
];

#[tauri::command]
pub fn list_tags(state: State<'_, AppState>, category: Option<String>) -> Result<Vec<Tag>, String> {
    let category = normalize_optional_string(category);
    if let Some(category) = category.as_deref() {
        validate_category(category)?;
    }

    state
        .with_connection(|connection| tag_repository::list_tags(connection, category.as_deref()))
        .map_err(database_error)
}

#[tauri::command]
pub fn create_custom_tag(
    state: State<'_, AppState>,
    payload: CreateTagPayload,
) -> Result<Tag, String> {
    let name = validate_name(&payload.name)?;
    let category =
        normalize_optional_string(payload.category.clone()).unwrap_or_else(|| "custom".to_string());
    validate_category(&category)?;
    let color = normalize_optional_string(payload.color.clone());
    validate_color(color.as_deref())?;

    state
        .with_connection(|connection| {
            ensure_tag_name_available(connection, name, &category, None)?;
            let normalized_payload = CreateTagPayload {
                name: name.to_string(),
                category: Some(category.clone()),
                color,
            };
            tag_repository::create_custom_tag(connection, &normalized_payload, &category)
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn update_tag(
    state: State<'_, AppState>,
    id: String,
    payload: UpdateTagPayload,
) -> Result<Tag, String> {
    validate_id(&id, "标签 ID 不能为空")?;
    let name = validate_name(&payload.name)?;

    state
        .with_connection(|connection| {
            let existing = tag_repository::get_tag(connection, &id)?
                .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;
            let category = normalize_optional_string(payload.category.clone())
                .unwrap_or_else(|| existing.category.clone());
            validate_category_as_sqlite(&category)?;

            if existing.is_preset && category != existing.category {
                return Err(rusqlite::Error::InvalidParameterName(
                    "系统预设标签不允许修改分类".into(),
                ));
            }

            ensure_tag_name_available(connection, name, &category, Some(&id))?;
            let normalized_payload = UpdateTagPayload {
                name: name.to_string(),
                category: Some(category.clone()),
            };

            tag_repository::update_tag(connection, &id, &normalized_payload, &category)?
                .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn update_tag_color(
    state: State<'_, AppState>,
    id: String,
    color: Option<String>,
) -> Result<Tag, String> {
    validate_id(&id, "标签 ID 不能为空")?;
    let color = normalize_optional_string(color);
    validate_color(color.as_deref())?;

    state
        .with_connection(|connection| {
            tag_repository::update_tag_color(connection, &id, color.as_deref())?
                .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn delete_tag(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    validate_id(&id, "标签 ID 不能为空")?;

    state
        .with_connection(|connection| {
            let existing = tag_repository::get_tag(connection, &id)?
                .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

            if existing.is_preset {
                return Err(rusqlite::Error::InvalidParameterName(
                    "系统预设标签不允许删除".into(),
                ));
            }

            tag_repository::delete_tag(connection, &id)
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn list_tags_by_usage(
    state: State<'_, AppState>,
    target_type: Option<String>,
) -> Result<Vec<TagUsage>, String> {
    // TODO(P1): extend usage statistics to technique_card_tags when technique cards land.
    let target_type =
        normalize_optional_string(target_type).unwrap_or_else(|| "inspiration".to_string());

    if target_type != "inspiration" {
        return Err(
            "当前阶段仅支持统计灵感卡片标签使用次数，技术卡片标签统计将在 P1 扩展".to_string(),
        );
    }

    state
        .with_connection(tag_repository::list_tags_by_inspiration_usage)
        .map_err(database_error)
}

fn ensure_tag_name_available(
    connection: &rusqlite::Connection,
    name: &str,
    category: &str,
    current_id: Option<&str>,
) -> rusqlite::Result<()> {
    if let Some(existing) =
        tag_repository::find_tag_by_name_and_category(connection, name, category)?
    {
        if current_id != Some(existing.id.as_str()) {
            return Err(rusqlite::Error::InvalidParameterName(
                "同一分类下已存在同名标签".into(),
            ));
        }
    }

    Ok(())
}

fn validate_name(name: &str) -> Result<&str, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("标签名称不能为空".to_string());
    }

    Ok(trimmed)
}

fn validate_category(category: &str) -> Result<(), String> {
    if VALID_TAG_CATEGORIES.contains(&category) {
        Ok(())
    } else {
        Err("标签分类无效".to_string())
    }
}

fn validate_category_as_sqlite(category: &str) -> rusqlite::Result<()> {
    validate_category(category).map_err(rusqlite_validation_error)
}

fn validate_color(color: Option<&str>) -> Result<(), String> {
    let Some(color) = color else {
        return Ok(());
    };

    let is_valid = color.len() == 7
        && color.starts_with('#')
        && color[1..]
            .chars()
            .all(|character| character.is_ascii_hexdigit());

    if is_valid {
        Ok(())
    } else {
        Err("标签颜色格式必须为 #RRGGBB".to_string())
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
        rusqlite::Error::QueryReturnedNoRows => "未找到标签".to_string(),
        rusqlite::Error::InvalidParameterName(message) => message,
        other => database_error(other),
    }
}

fn database_error(error: rusqlite::Error) -> String {
    format!("数据库操作失败：{error}")
}

fn rusqlite_validation_error(message: String) -> rusqlite::Error {
    rusqlite::Error::InvalidParameterName(message)
}
