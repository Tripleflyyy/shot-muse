use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct ShootingPlan {
    pub id: String,
    pub project_id: String,
    pub project_name: Option<String>,
    pub title: String,
    pub shooting_theme: Option<String>,
    pub gear_list: Option<String>,
    pub scene_list: Option<String>,
    pub action_list: Option<String>,
    pub composition_reference: Option<String>,
    pub lighting_reference: Option<String>,
    pub post_style: Option<String>,
    pub technique_notes: Option<String>,
    pub notes: Option<String>,
    pub cover_media_asset_id: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ShootingPlanPayload {
    pub project_id: String,
    pub title: String,
    pub shooting_theme: Option<String>,
    pub gear_list: Option<String>,
    pub scene_list: Option<String>,
    pub action_list: Option<String>,
    pub composition_reference: Option<String>,
    pub lighting_reference: Option<String>,
    pub post_style: Option<String>,
    pub technique_notes: Option<String>,
    pub notes: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ShootingPlanFilters {
    pub project_id: Option<String>,
    pub status: Option<String>,
    pub keyword: Option<String>,
}
