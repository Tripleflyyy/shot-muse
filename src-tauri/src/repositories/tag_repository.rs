use rusqlite::{params, Connection};

use crate::models::PresetTag;

const DEFAULT_TAGS: &[PresetTag] = &[
    PresetTag::new("人像", "subject", "#F97316"),
    PresetTag::new("街拍", "subject", "#F97316"),
    PresetTag::new("风景", "subject", "#F97316"),
    PresetTag::new("夜景", "subject", "#F97316"),
    PresetTag::new("旅行", "subject", "#F97316"),
    PresetTag::new("美食", "subject", "#F97316"),
    PresetTag::new("宠物", "subject", "#F97316"),
    PresetTag::new("建筑", "subject", "#F97316"),
    PresetTag::new("逆光", "lighting", "#FACC15"),
    PresetTag::new("侧光", "lighting", "#FACC15"),
    PresetTag::new("窗边光", "lighting", "#FACC15"),
    PresetTag::new("蓝调时刻", "lighting", "#FACC15"),
    PresetTag::new("夕阳", "lighting", "#FACC15"),
    PresetTag::new("霓虹", "lighting", "#FACC15"),
    PresetTag::new("硬光", "lighting", "#FACC15"),
    PresetTag::new("柔光", "lighting", "#FACC15"),
    PresetTag::new("三分法", "composition", "#22C55E"),
    PresetTag::new("中心构图", "composition", "#22C55E"),
    PresetTag::new("框架构图", "composition", "#22C55E"),
    PresetTag::new("前景遮挡", "composition", "#22C55E"),
    PresetTag::new("对称构图", "composition", "#22C55E"),
    PresetTag::new("低角度", "composition", "#22C55E"),
    PresetTag::new("俯拍", "composition", "#22C55E"),
    PresetTag::new("暖色", "color", "#EF4444"),
    PresetTag::new("冷色", "color", "#3B82F6"),
    PresetTag::new("低饱和", "color", "#64748B"),
    PresetTag::new("高对比", "color", "#111827"),
    PresetTag::new("胶片感", "color", "#A16207"),
    PresetTag::new("黑白", "color", "#525252"),
    PresetTag::new("日系", "color", "#EC4899"),
    PresetTag::new("港风", "color", "#DC2626"),
    PresetTag::new("松弛", "mood", "#14B8A6"),
    PresetTag::new("孤独", "mood", "#6366F1"),
    PresetTag::new("浪漫", "mood", "#F472B6"),
    PresetTag::new("复古", "mood", "#92400E"),
    PresetTag::new("清冷", "mood", "#0EA5E9"),
    PresetTag::new("自由", "mood", "#10B981"),
    PresetTag::new("故事感", "mood", "#8B5CF6"),
    PresetTag::new("布光", "technique", "#F59E0B"),
    PresetTag::new("构图", "technique", "#F59E0B"),
    PresetTag::new("调色", "technique", "#F59E0B"),
    PresetTag::new("人像引导", "technique", "#F59E0B"),
    PresetTag::new("后期处理", "technique", "#F59E0B"),
    PresetTag::new("器材使用", "technique", "#F59E0B"),
];

pub fn insert_preset_tags(connection: &Connection) -> rusqlite::Result<usize> {
    let now = "1970-01-01T00:00:00Z";
    let transaction = connection.unchecked_transaction()?;
    let mut inserted_count = 0;

    {
        let mut statement = transaction.prepare(
            "
            INSERT OR IGNORE INTO tags (
              id,
              name,
              category,
              color,
              is_preset,
              created_at,
              updated_at
            )
            VALUES (?1, ?2, ?3, ?4, 1, ?5, ?5)
            ",
        )?;

        for tag in DEFAULT_TAGS {
            inserted_count += statement.execute(params![
                preset_tag_id(tag.name, tag.category),
                tag.name,
                tag.category,
                tag.color,
                now,
            ])?;
        }
    }

    transaction.commit()?;
    Ok(inserted_count)
}

pub fn preset_tag_count() -> usize {
    DEFAULT_TAGS.len()
}

fn preset_tag_id(name: &str, category: &str) -> String {
    format!("preset:{}:{}", category, name)
}
