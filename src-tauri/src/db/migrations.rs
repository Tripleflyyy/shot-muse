use rusqlite::Connection;

use crate::repositories::tag_repository;

pub fn run_migrations(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          theme TEXT,
          description TEXT,
          location TEXT,
          planned_shooting_time TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS inspiration_cards (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          source_platform TEXT NOT NULL,
          source_url TEXT,
          author_name TEXT,
          notes TEXT,
          project_id TEXT,
          collected_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          color TEXT,
          is_preset INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(name, category)
        );

        CREATE TABLE IF NOT EXISTS inspiration_card_tags (
          inspiration_card_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (inspiration_card_id, tag_id),
          FOREIGN KEY (inspiration_card_id) REFERENCES inspiration_cards(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS shooting_plans (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          shooting_theme TEXT,
          gear_list TEXT,
          scene_list TEXT,
          action_list TEXT,
          composition_reference TEXT,
          lighting_reference TEXT,
          post_style TEXT,
          technique_notes TEXT,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS shooting_plan_inspirations (
          shooting_plan_id TEXT NOT NULL,
          inspiration_card_id TEXT NOT NULL,
          PRIMARY KEY (shooting_plan_id, inspiration_card_id),
          FOREIGN KEY (shooting_plan_id) REFERENCES shooting_plans(id) ON DELETE CASCADE,
          FOREIGN KEY (inspiration_card_id) REFERENCES inspiration_cards(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS media_assets (
          id TEXT PRIMARY KEY,
          target_type TEXT NOT NULL,
          target_id TEXT,
          file_path TEXT NOT NULL,
          original_filename TEXT,
          mime_type TEXT,
          file_size INTEGER,
          width INTEGER,
          height INTEGER,
          source_type TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_projects_updated_at
        ON projects(updated_at);

        CREATE INDEX IF NOT EXISTS idx_inspiration_cards_project_id
        ON inspiration_cards(project_id);

        CREATE INDEX IF NOT EXISTS idx_inspiration_cards_source_platform
        ON inspiration_cards(source_platform);

        CREATE INDEX IF NOT EXISTS idx_inspiration_cards_collected_at
        ON inspiration_cards(collected_at);

        CREATE INDEX IF NOT EXISTS idx_shooting_plans_project_id
        ON shooting_plans(project_id);

        CREATE INDEX IF NOT EXISTS idx_shooting_plans_status
        ON shooting_plans(status);

        CREATE INDEX IF NOT EXISTS idx_media_assets_target
        ON media_assets(target_type, target_id);

        CREATE INDEX IF NOT EXISTS idx_tags_category
        ON tags(category);
        ",
    )
}

pub fn seed_default_tags(connection: &Connection) -> rusqlite::Result<usize> {
    tag_repository::insert_preset_tags(connection)
}
