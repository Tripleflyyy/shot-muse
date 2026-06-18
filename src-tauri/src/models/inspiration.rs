use serde::{Deserialize, Serialize};

use crate::models::Tag;

#[derive(Debug, Clone, Serialize)]
pub struct InspirationCard {
    pub id: String,
    pub card_type: String,
    pub title: String,
    pub source_platform: String,
    pub source_url: Option<String>,
    pub author_name: Option<String>,
    pub notes: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub cover_media_asset_id: Option<String>,
    pub collected_at: String,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InspirationCardPayload {
    pub card_type: Option<String>,
    pub title: String,
    pub source_platform: String,
    pub source_url: Option<String>,
    pub author_name: Option<String>,
    pub notes: Option<String>,
    pub project_id: Option<String>,
    pub collected_at: Option<String>,
    pub tag_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InspirationCardFilters {
    pub card_type: Option<String>,
    pub project_id: Option<String>,
    pub source_platform: Option<String>,
    pub keyword: Option<String>,
    pub tag_ids: Option<Vec<String>>,
}
