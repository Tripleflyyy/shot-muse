pub mod commands;
pub mod db;
pub mod models;
pub mod repositories;
pub mod state;

pub use state::AppState;

pub fn app_builder(app_state: AppState) -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::app_commands::get_app_status,
            commands::app_commands::health_check
        ])
}
