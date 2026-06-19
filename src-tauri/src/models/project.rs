use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub theme: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub planned_shooting_time: Option<String>,
    pub notes: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectPayload {
    pub name: String,
    pub theme: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub planned_shooting_time: Option<String>,
    pub notes: Option<String>,
    pub sort_order: Option<i64>,
}
