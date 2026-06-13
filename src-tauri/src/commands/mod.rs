pub mod app_commands;
pub mod inspiration_commands;
pub mod project_commands;
pub mod tag_commands;

pub use app_commands::{get_app_status, health_check};
pub use inspiration_commands::{
    attach_inspiration_to_project, attach_tag_to_inspiration, create_inspiration_card,
    delete_inspiration_card, detach_inspiration_from_project, detach_tag_from_inspiration,
    get_inspiration_card, list_inspiration_cards, list_project_inspirations,
    update_inspiration_card,
};
pub use project_commands::{
    create_project, delete_project, get_project, list_projects, update_project,
};
pub use tag_commands::{
    create_custom_tag, delete_tag, list_tags, list_tags_by_usage, update_tag, update_tag_color,
};
