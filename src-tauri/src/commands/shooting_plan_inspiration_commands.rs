use tauri::State;

use crate::models::InspirationCard;
use crate::repositories::shooting_plan_inspiration_repository;
use crate::state::AppState;

#[tauri::command]
pub fn attach_inspiration_to_shooting_plan(
    state: State<'_, AppState>,
    shooting_plan_id: String,
    inspiration_card_id: String,
) -> Result<bool, String> {
    validate_id(&shooting_plan_id, "拍摄计划 ID 不能为空")?;
    validate_id(&inspiration_card_id, "灵感卡片 ID 不能为空")?;

    state
        .with_connection(|connection| {
            ensure_shooting_plan_exists(connection, &shooting_plan_id)?;
            ensure_inspiration_exists(connection, &inspiration_card_id)?;
            shooting_plan_inspiration_repository::attach_inspiration_to_shooting_plan(
                connection,
                &shooting_plan_id,
                &inspiration_card_id,
            )
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn detach_inspiration_from_shooting_plan(
    state: State<'_, AppState>,
    shooting_plan_id: String,
    inspiration_card_id: String,
) -> Result<bool, String> {
    validate_id(&shooting_plan_id, "拍摄计划 ID 不能为空")?;
    validate_id(&inspiration_card_id, "灵感卡片 ID 不能为空")?;

    state
        .with_connection(|connection| {
            ensure_shooting_plan_exists(connection, &shooting_plan_id)?;
            ensure_inspiration_exists(connection, &inspiration_card_id)?;
            shooting_plan_inspiration_repository::detach_inspiration_from_shooting_plan(
                connection,
                &shooting_plan_id,
                &inspiration_card_id,
            )
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn list_shooting_plan_inspirations(
    state: State<'_, AppState>,
    shooting_plan_id: String,
) -> Result<Vec<InspirationCard>, String> {
    validate_id(&shooting_plan_id, "拍摄计划 ID 不能为空")?;

    state
        .with_connection(|connection| {
            ensure_shooting_plan_exists(connection, &shooting_plan_id)?;
            shooting_plan_inspiration_repository::list_shooting_plan_inspirations(
                connection,
                &shooting_plan_id,
            )
        })
        .map_err(command_error)
}

#[tauri::command]
pub fn list_available_inspirations_for_shooting_plan(
    state: State<'_, AppState>,
    shooting_plan_id: String,
    keyword: Option<String>,
    source_platform: Option<String>,
) -> Result<Vec<InspirationCard>, String> {
    validate_id(&shooting_plan_id, "拍摄计划 ID 不能为空")?;

    let keyword = normalize_optional_string(keyword);
    let source_platform = normalize_optional_string(source_platform);

    state
        .with_connection(|connection| {
            ensure_shooting_plan_exists(connection, &shooting_plan_id)?;
            shooting_plan_inspiration_repository::list_available_inspirations_for_shooting_plan(
                connection,
                &shooting_plan_id,
                keyword.as_deref(),
                source_platform.as_deref(),
            )
        })
        .map_err(command_error)
}

fn ensure_shooting_plan_exists(
    connection: &rusqlite::Connection,
    id: &str,
) -> rusqlite::Result<()> {
    if shooting_plan_inspiration_repository::shooting_plan_exists(connection, id)? {
        Ok(())
    } else {
        Err(validation_error("拍摄计划不存在"))
    }
}

fn ensure_inspiration_exists(connection: &rusqlite::Connection, id: &str) -> rusqlite::Result<()> {
    if shooting_plan_inspiration_repository::inspiration_exists(connection, id)? {
        Ok(())
    } else {
        Err(validation_error("灵感卡片不存在"))
    }
}

fn validate_id(id: &str, message: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err(message.to_string());
    }

    Ok(())
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

    #[test]
    fn validation_rejects_empty_ids() {
        assert_eq!(
            validate_id("", "拍摄计划 ID 不能为空").expect_err("empty shooting plan id"),
            "拍摄计划 ID 不能为空"
        );
        assert_eq!(
            validate_id("", "灵感卡片 ID 不能为空").expect_err("empty inspiration id"),
            "灵感卡片 ID 不能为空"
        );
    }

    #[test]
    fn validation_rejects_missing_records() {
        let connection = test_connection();

        let plan_error =
            ensure_shooting_plan_exists(&connection, "missing-plan").expect_err("missing plan");
        assert_eq!(command_error(plan_error), "拍摄计划不存在");

        let inspiration_error = ensure_inspiration_exists(&connection, "missing-inspiration")
            .expect_err("missing inspiration");
        assert_eq!(command_error(inspiration_error), "灵感卡片不存在");
    }
}
