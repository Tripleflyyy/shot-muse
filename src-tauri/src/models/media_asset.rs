use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct MediaAsset {
    pub id: String,
    pub target_type: String,
    pub target_id: Option<String>,
    pub file_path: String,
    pub original_filename: Option<String>,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub source_type: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MediaAssetPayload {
    pub target_type: String,
    pub target_id: Option<String>,
    pub file_path: String,
    pub original_filename: Option<String>,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub source_type: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MediaAssetFilters {
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub source_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateMediaAssetTargetPayload {
    pub target_type: String,
    pub target_id: Option<String>,
}
