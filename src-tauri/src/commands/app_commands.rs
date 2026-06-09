use tauri::State;

use crate::models::AppStatus;
use crate::state::AppState;

#[tauri::command]
pub fn get_app_status(state: State<'_, AppState>) -> Result<AppStatus, String> {
    state.status().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn health_check(state: State<'_, AppState>) -> Result<AppStatus, String> {
    get_app_status(state)
}
