pub mod app_commands;
pub mod inspiration_commands;
pub mod media_commands;
pub mod project_commands;
pub mod shooting_plan_commands;
pub mod shooting_plan_inspiration_commands;
pub mod tag_commands;

pub use app_commands::{get_app_status, health_check};
pub use inspiration_commands::{
    attach_inspiration_to_project, attach_tag_to_inspiration, create_inspiration_card,
    delete_inspiration_card, detach_inspiration_from_project, detach_tag_from_inspiration,
    get_inspiration_card, list_inspiration_cards, list_project_inspirations,
    update_inspiration_card,
};
pub use media_commands::{
    create_media_asset, delete_media_asset, get_media_asset, import_local_image,
    import_shooting_plan_image, list_media_assets, list_media_assets_by_target,
    update_media_asset_target,
};
pub use project_commands::{
    create_project, delete_project, get_project, list_projects, update_project,
};
pub use shooting_plan_commands::{
    create_shooting_plan, delete_shooting_plan, get_shooting_plan, list_shooting_plans,
    list_shooting_plans_by_project, update_shooting_plan, update_shooting_plan_cover,
};
pub use shooting_plan_inspiration_commands::{
    attach_inspiration_to_shooting_plan, detach_inspiration_from_shooting_plan,
    list_available_inspirations_for_shooting_plan, list_shooting_plan_inspirations,
};
pub use tag_commands::{
    create_custom_tag, delete_tag, list_tags, list_tags_by_usage, update_tag, update_tag_color,
};
