use serde::{Deserialize, Serialize};

pub struct PresetTag {
    pub name: &'static str,
    pub category: &'static str,
    pub color: &'static str,
}

impl PresetTag {
    pub const fn new(name: &'static str, category: &'static str, color: &'static str) -> Self {
        Self {
            name,
            category,
            color,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub category: String,
    pub color: Option<String>,
    pub is_preset: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TagUsage {
    pub tag: Tag,
    pub usage_count: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateTagPayload {
    pub name: String,
    pub category: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateTagPayload {
    pub name: String,
    pub category: Option<String>,
}
