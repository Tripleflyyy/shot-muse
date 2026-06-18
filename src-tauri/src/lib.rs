pub mod commands;
pub mod db;
pub mod media;
pub mod models;
pub mod repositories;
pub mod state;

pub use state::AppState;

use tauri::Manager;

pub fn app_builder(app_state: AppState) -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::app_commands::get_app_status,
            commands::app_commands::health_check,
            commands::project_commands::create_project,
            commands::project_commands::update_project,
            commands::project_commands::delete_project,
            commands::project_commands::get_project,
            commands::project_commands::list_projects,
            commands::inspiration_commands::create_inspiration_card,
            commands::inspiration_commands::update_inspiration_card,
            commands::inspiration_commands::delete_inspiration_card,
            commands::inspiration_commands::get_inspiration_card,
            commands::inspiration_commands::list_inspiration_cards,
            commands::inspiration_commands::attach_tag_to_inspiration,
            commands::inspiration_commands::detach_tag_from_inspiration,
            commands::inspiration_commands::attach_inspiration_to_project,
            commands::inspiration_commands::detach_inspiration_from_project,
            commands::inspiration_commands::list_project_inspirations,
            commands::inspiration_commands::update_inspiration_card_cover,
            commands::media_commands::create_media_asset,
            commands::media_commands::get_media_asset,
            commands::media_commands::list_media_assets,
            commands::media_commands::list_media_assets_by_target,
            commands::media_commands::update_media_asset_target,
            commands::media_commands::delete_media_asset,
            commands::media_commands::reorder_media_assets,
            commands::media_commands::import_local_image,
            commands::media_commands::import_shooting_plan_image,
            commands::tag_commands::list_tags,
            commands::tag_commands::create_custom_tag,
            commands::tag_commands::update_tag,
            commands::tag_commands::update_tag_color,
            commands::tag_commands::delete_tag,
            commands::tag_commands::list_tags_by_usage,
            commands::shooting_plan_commands::create_shooting_plan,
            commands::shooting_plan_commands::update_shooting_plan,
            commands::shooting_plan_commands::delete_shooting_plan,
            commands::shooting_plan_commands::get_shooting_plan,
            commands::shooting_plan_commands::list_shooting_plans,
            commands::shooting_plan_commands::list_shooting_plans_by_project,
            commands::shooting_plan_commands::update_shooting_plan_cover,
            commands::shooting_plan_inspiration_commands::attach_inspiration_to_shooting_plan,
            commands::shooting_plan_inspiration_commands::detach_inspiration_from_shooting_plan,
            commands::shooting_plan_inspiration_commands::list_shooting_plan_inspirations,
            commands::shooting_plan_inspiration_commands::list_available_inspirations_for_shooting_plan
        ])
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let app_state = AppState::initialize(&app_data_dir)?;
            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_commands::get_app_status,
            commands::app_commands::health_check,
            commands::project_commands::create_project,
            commands::project_commands::update_project,
            commands::project_commands::delete_project,
            commands::project_commands::get_project,
            commands::project_commands::list_projects,
            commands::inspiration_commands::create_inspiration_card,
            commands::inspiration_commands::update_inspiration_card,
            commands::inspiration_commands::delete_inspiration_card,
            commands::inspiration_commands::get_inspiration_card,
            commands::inspiration_commands::list_inspiration_cards,
            commands::inspiration_commands::attach_tag_to_inspiration,
            commands::inspiration_commands::detach_tag_from_inspiration,
            commands::inspiration_commands::attach_inspiration_to_project,
            commands::inspiration_commands::detach_inspiration_from_project,
            commands::inspiration_commands::list_project_inspirations,
            commands::inspiration_commands::update_inspiration_card_cover,
            commands::media_commands::create_media_asset,
            commands::media_commands::get_media_asset,
            commands::media_commands::list_media_assets,
            commands::media_commands::list_media_assets_by_target,
            commands::media_commands::update_media_asset_target,
            commands::media_commands::delete_media_asset,
            commands::media_commands::reorder_media_assets,
            commands::media_commands::import_local_image,
            commands::media_commands::import_shooting_plan_image,
            commands::tag_commands::list_tags,
            commands::tag_commands::create_custom_tag,
            commands::tag_commands::update_tag,
            commands::tag_commands::update_tag_color,
            commands::tag_commands::delete_tag,
            commands::tag_commands::list_tags_by_usage,
            commands::shooting_plan_commands::create_shooting_plan,
            commands::shooting_plan_commands::update_shooting_plan,
            commands::shooting_plan_commands::delete_shooting_plan,
            commands::shooting_plan_commands::get_shooting_plan,
            commands::shooting_plan_commands::list_shooting_plans,
            commands::shooting_plan_commands::list_shooting_plans_by_project,
            commands::shooting_plan_commands::update_shooting_plan_cover,
            commands::shooting_plan_inspiration_commands::attach_inspiration_to_shooting_plan,
            commands::shooting_plan_inspiration_commands::detach_inspiration_from_shooting_plan,
            commands::shooting_plan_inspiration_commands::list_shooting_plan_inspirations,
            commands::shooting_plan_inspiration_commands::list_available_inspirations_for_shooting_plan
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Shot Muse Tauri application");
}
