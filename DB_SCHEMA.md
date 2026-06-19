# Shot Muse SQLite 数据库结构

## 1. 设计原则

- 所有 id 使用 UUID 字符串
- 时间字段使用 ISO 8601 字符串
- 图片资源统一通过 media_assets 管理
- 灵感卡片和技术卡片不直接保存 image_path
- 一张灵感卡片可以关联多张图片
- 一张技术卡片可以关联多张图片
- 前端 MVP 可以只显示第一张图
- 数据库设计支持未来多图扩展

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

当前 P0-11 实现选择低风险路径：继续沿用 `inspiration_cards` 表名，并在现有卡片表上增加 `card_type` 字段。完整 `reference_cards` 重构仍是后续演进，不是当前阶段。

`card_type` 当前允许值：

- inspiration
- technique

说明：统一卡片库用于支持“全部 / 灵感 / 技巧”视图，让图片、标签、来源、描述、搜索和 Plan 引用逻辑复用。

2. 多图卡片

当前 `media_assets` 已支持同一 `target_type + target_id` 关联多张图片。后续可增加以下能力：

- `cover_media_asset_id`：指定封面图
- `sort_order`：支持图片排序

说明：列表页只显示封面图；卡片详情 / 编辑页支持多图翻动，默认第一张图片作为封面。

3. Plan References

当前 `shooting_plan_inspirations` 继续作为 Plan 与统一卡片库的关联表。表名沿用历史命名，但 `inspiration_card_id` 指向的是 `inspiration_cards` 中的统一卡片记录，具体通过 `card_type` 区分灵感卡和技巧卡。

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

说明：`sort_order` 用于 Projects 页面中 Project section 的拖拽排序；查询默认按 `sort_order ASC, updated_at DESC`。P0-15.2 不新增 Project 统计字段。

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

`cover_media_asset_id` 可为空。为空时，卡片墙使用该卡片按 `sort_order ASC, created_at ASC` 排序后的第一张图片作为封面；非空时业务层校验对应 media asset 属于当前卡片。

## 4. technique_cards 表

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

## 7. technique_card_tags 表

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

说明：`sort_order` 用于同一 Project 下的 Plan 排序。Projects 页面上移 / 下移 Plan 时，会更新该 Project 下 Plan 的排序值；查询展示时按 `project_id ASC, sort_order ASC, created_at ASC`。

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

## 10. shooting_plan_techniques 表

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
- technique
- project
- plan

source_type 枚举建议：

- file_picker
- clipboard
- drag_drop

说明：

- target_id 可为空，用于支持“先上传图片，再保存卡片”的表单流程
- 卡片保存后，应将 media_assets.target_id 更新为对应卡片 id
- 一张卡片可通过 target_type + target_id 查询多张图片
- `sort_order` 用于卡片图集排序；查询卡片图片时按 `sort_order ASC, created_at ASC`
- 删除 media_assets 记录不删除真实文件；如果删除的是当前卡片封面，业务层清空 `cover_media_asset_id` 并回退到第一张图

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
