pub mod commands;
pub mod db;
pub mod models;
pub mod repositories;
pub mod state;

pub use state::AppState;

use tauri::Manager;

pub fn app_builder(app_state: AppState) -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::app_commands::get_app_status,
            commands::app_commands::health_check
        ])
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let app_state = AppState::initialize(&app_data_dir)?;
            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_commands::get_app_status,
            commands::app_commands::health_check
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Shot Muse Tauri application");
}
