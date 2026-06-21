# Shot Muse SQLite 数据库结构

## 1. 设计原则

- 所有 id 使用 UUID 字符串
- 时间字段使用 ISO 8601 字符串
- 图片资源统一通过 media_assets 管理
- Card Library 是全局卡片库，卡片不强制归属单一 Project
- 当前产品层统一称 Card / Reference Card
- 数据层短期保留 `inspiration_cards` 等历史表名，避免高风险重命名 migration
- 卡片不直接保存 image_path
- 一张卡片可以关联多张图片
- 列表页显示封面图，详情页可浏览多图

## 1.1 当前实现与计划演进

当前已实现层：

- projects
- inspiration_cards
- tags
- inspiration_card_tags
- media_assets
- shooting_plans
- shooting_plan_inspirations

计划中的数据库演进方向：

1. Card Library 统一卡片库

当前实现选择低风险路径：继续沿用 `inspiration_cards` 历史表名，并在现有卡片表上增加 `card_type` 字段。完整 `reference_cards` 重构或表重命名 migration 属于后续 P1 技术债，不是当前 P0 阶段。

`card_type` 当前允许值：

- inspiration
- technique

说明：统一卡片库用于支持“全部 / 灵感 / 技巧”视图，让图片、标签、来源、描述、搜索和 Plan 引用逻辑复用。技巧卡是 `card_type = technique` 的卡片，不启用独立的第二套技巧卡主流程。

2. 多图卡片

当前 `media_assets` 已支持同一 `target_type + target_id` 关联多张图片，并通过 `sort_order` 支持图片排序。`inspiration_cards.cover_media_asset_id` 指定卡片封面；为空时回退到排序后的第一张图片。

3. Plan References

当前 `shooting_plan_inspirations` 继续作为 Plan 与统一卡片库的关联表。表名沿用历史命名，但 `inspiration_card_id` 指向的是 `inspiration_cards` 中的统一卡片记录，具体通过 `card_type` 区分灵感卡和技巧卡。产品层统一称为 Plan 引用 Reference Card。

约束：

- 关联只建立引用关系。
- 不复制卡片。
- 不移动卡片。
- 移除关联不删除原卡片。
- 一个卡片可以被多个 Plan 复用。

## 2. projects 表

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  theme TEXT,
  description TEXT,
  location TEXT,
  planned_shooting_time TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

说明：`sort_order` 用于 Projects 页面中 Project section 的轻量排序；查询默认按 `sort_order ASC, updated_at DESC`。Project 当前不使用拖拽作为主要排序方式。

## 3. inspiration_cards 表

```sql
CREATE TABLE IF NOT EXISTS inspiration_cards (
  id TEXT PRIMARY KEY,
  card_type TEXT NOT NULL DEFAULT 'inspiration',
  title TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  source_url TEXT,
  author_name TEXT,
  notes TEXT,
  project_id TEXT,
  cover_media_asset_id TEXT,
  collected_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
```

source_platform 建议值：

- douyin
- xiaohongshu
- bilibili
- youtube
- instagram
- other

card_type 当前允许值：

- inspiration
- technique

说明：历史卡片默认 `inspiration`。P0-11 后，卡片库页面通过该字段提供“全部 / 灵感 / 技巧”视图；当前仍不重命名 `inspiration_cards`。

`project_id` 是历史 / 可选关联字段。当前主流程不依赖它表达卡片归属，Card 默认是全局素材，可被多个 Plan / Project 复用。

`cover_media_asset_id` 可为空。为空时，卡片墙使用该卡片按 `sort_order ASC, created_at ASC` 排序后的第一张图片作为封面；非空时业务层校验对应 media asset 属于当前卡片。删除对应 media_assets 记录时，业务层会清空该字段。

## 4. technique_cards 表（历史设计 / 当前不参与主流程）

当前真实实现中，技巧卡并入 `inspiration_cards`，通过 `card_type = technique` 区分。以下独立 `technique_cards` 表是早期设计记录，当前主流程不启用，也不应被理解为第二套技巧卡系统。

```sql
CREATE TABLE IF NOT EXISTS technique_cards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  applicable_scenes TEXT,
  recommended_gear TEXT,
  camera_settings TEXT,
  lighting_setup TEXT,
  composition_method TEXT,
  shooting_steps TEXT,
  post_processing TEXT,
  source_url TEXT,
  source_platform TEXT,
  notes TEXT,
  collected_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

category 建议值：

- basic
- composition
- lighting
- color
- portrait_direction
- scene_direction
- gear
- post_processing
- commercial
- other

source_platform 建议值：

- course
- book
- douyin
- xiaohongshu
- bilibili
- youtube
- instagram
- other

## 5. tags 表

```sql
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
```

标签分类枚举：

- subject
- lighting
- composition
- color
- mood
- technique
- custom

is_preset：

- 0：用户自定义
- 1：系统预设

## 6. inspiration_card_tags 表

```sql
CREATE TABLE IF NOT EXISTS inspiration_card_tags (
  inspiration_card_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (inspiration_card_id, tag_id),
  FOREIGN KEY (inspiration_card_id) REFERENCES inspiration_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

## 7. technique_card_tags 表（历史设计 / 当前不参与主流程）

当前标签关系复用 `inspiration_card_tags`，并通过 `inspiration_cards.card_type` 区分灵感卡 / 技巧卡。以下独立技巧卡标签关系表是早期设计记录。

```sql
CREATE TABLE IF NOT EXISTS technique_card_tags (
  technique_card_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (technique_card_id, tag_id),
  FOREIGN KEY (technique_card_id) REFERENCES technique_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

## 8. shooting_plans 表

```sql
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
  cover_media_asset_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

status 枚举建议：

- draft
- ready
- completed
- archived

说明：`sort_order` 用于同一 Project 下的 Plan 排序。Projects / Shooting Plans 页面通过卡片侧边排序箭头更新该 Project 下 Plan 的排序值；查询展示时按 `project_id ASC, sort_order ASC, created_at ASC`。

`cover_media_asset_id` 可为空。删除对应 media_assets 记录时，业务层会清空该字段，避免 Plan 卡片封面出现 dangling cover id。

## 9. shooting_plan_inspirations 表

```sql
CREATE TABLE IF NOT EXISTS shooting_plan_inspirations (
  shooting_plan_id TEXT NOT NULL,
  inspiration_card_id TEXT NOT NULL,
  PRIMARY KEY (shooting_plan_id, inspiration_card_id),
  FOREIGN KEY (shooting_plan_id) REFERENCES shooting_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (inspiration_card_id) REFERENCES inspiration_cards(id) ON DELETE CASCADE
);
```

说明：P0-14 不新增 `shooting_plan_reference_cards`，也不重命名该表。产品层统一称为“参考卡片”，移除关联只删除本表记录，不删除原卡片。

## 10. shooting_plan_techniques 表（历史设计 / 当前不参与主流程）

当前 Plan 参考卡片统一复用 `shooting_plan_inspirations`，并通过 `inspiration_cards.card_type` 支持灵感卡 / 技巧卡。以下独立技巧卡关联表是早期设计记录。

```sql
CREATE TABLE IF NOT EXISTS shooting_plan_techniques (
  shooting_plan_id TEXT NOT NULL,
  technique_card_id TEXT NOT NULL,
  PRIMARY KEY (shooting_plan_id, technique_card_id),
  FOREIGN KEY (shooting_plan_id) REFERENCES shooting_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (technique_card_id) REFERENCES technique_cards(id) ON DELETE CASCADE
);
```

## 11. media_assets 表

```sql
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
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

target_type 枚举建议：

- inspiration
- shooting_plan
- technique（历史 / 兼容枚举，当前主流程不写入）
- project（历史 / 兼容枚举，当前主流程不写入）
- plan（历史 / 兼容枚举，当前主流程不写入）

source_type 枚举建议：

- file_picker
- clipboard
- drag_drop
- local

说明：

- Card Library 图片统一使用 `target_type = inspiration`，即使该卡片是 `card_type = technique`
- Shooting Plan 图片统一使用 `target_type = shooting_plan`
- target_id 可为空，用于支持“先上传图片，再保存对象”的表单流程
- 对象保存后，应将 media_assets.target_id 更新为对应对象 id
- 一个对象可通过 target_type + target_id 查询多张图片
- `sort_order` 用于图集排序；查询图片时按 `sort_order ASC, created_at ASC`
- 删除 media_assets 记录不删除真实文件；如果删除的是当前卡片或 Plan 封面，业务层清空对应 `cover_media_asset_id` 并回退到第一张图
- 不删除真实文件是保守策略，用于避免误删用户素材；后续通过孤儿文件检查 / 安全清理功能处理媒体目录维护

## 12. 索引

```sql
CREATE INDEX IF NOT EXISTS idx_projects_updated_at
ON projects(updated_at);

CREATE INDEX IF NOT EXISTS idx_inspiration_cards_project_id
ON inspiration_cards(project_id);

CREATE INDEX IF NOT EXISTS idx_inspiration_cards_source_platform
ON inspiration_cards(source_platform);

CREATE INDEX IF NOT EXISTS idx_inspiration_cards_card_type
ON inspiration_cards(card_type);

CREATE INDEX IF NOT EXISTS idx_inspiration_cards_collected_at
ON inspiration_cards(collected_at);

CREATE INDEX IF NOT EXISTS idx_technique_cards_category
ON technique_cards(category);

CREATE INDEX IF NOT EXISTS idx_technique_cards_source_platform
ON technique_cards(source_platform);

CREATE INDEX IF NOT EXISTS idx_shooting_plans_project_id
ON shooting_plans(project_id);

CREATE INDEX IF NOT EXISTS idx_shooting_plans_status
ON shooting_plans(status);

CREATE INDEX IF NOT EXISTS idx_media_assets_target
ON media_assets(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_tags_category
ON tags(category);
```

## 13. 默认数据初始化

系统启动或 migration 完成后初始化预设标签。

初始化规则：

- 使用 INSERT OR IGNORE
- is_preset = 1
- 同分类下 name 唯一
- 如果用户已存在同名同分类标签，不重复插入

题材标签 subject：

- 人像
- 街拍
- 风景
- 夜景
- 旅行
- 美食
- 宠物
- 建筑

光线标签 lighting：

- 逆光
- 侧光
- 窗边光
- 蓝调时刻
- 夕阳
- 霓虹
- 硬光
- 柔光

构图标签 composition：

- 三分法
- 中心构图
- 框架构图
- 前景遮挡
- 对称构图
- 低角度
- 俯拍

色彩标签 color：

- 暖色
- 冷色
- 低饱和
- 高对比
- 胶片感
- 黑白
- 日系
- 港风

情绪标签 mood：

- 松弛
- 孤独
- 浪漫
- 复古
- 清冷
- 自由
- 故事感

技术标签 technique：

- 布光
- 构图
- 调色
- 人像引导
- 后期处理
- 器材使用

## 14. Migration 策略

当前 migration 机制适合 MVP 阶段的增量 schema 补齐：

- 启动时创建缺失表
- 使用幂等 SQL / `CREATE TABLE IF NOT EXISTS`
- 使用 `PRAGMA table_info` 检查缺失列并补齐
- 使用 `PRAGMA user_version` 标记当前 schema 版本
- 使用 `INSERT OR IGNORE` 初始化预设数据

本阶段不做表重命名 migration，也不把 `inspiration_cards` / `shooting_plan_inspirations` 重命名为新的产品概念表。后续 P1 技术债建议升级为版本化 SQL migration 或 `schema_migrations` 表，以便支持更复杂的 schema 演进、回滚审计和数据迁移验证。
