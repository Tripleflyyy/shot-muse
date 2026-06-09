# Shot Muse 系统架构设计

## 1. 项目定位

Shot Muse 是一款面向摄影爱好者的跨平台桌面应用，用于收集摄影灵感、记录摄影技术、整理风格标签，并将灵感与技术沉淀为可执行的拍摄计划。

用户经常在抖音、小红书、B站、YouTube、Instagram 等平台浏览摄影作品获取灵感。Shot Muse 第一阶段不接入平台接口、不做爬虫、不下载他人作品，而是帮助用户保存作品链接、导入截图、记录备注、整理标签，并生成自己的拍摄计划。

第一阶段目标是跑通本地 MVP 主流程：用户可以创建摄影项目，添加灵感卡片和摄影技术卡片，打标签，导入截图或本地图片，组合生成拍摄计划，并导出 Markdown 文件。

第一阶段明确不包含：AI 自动生成、平台接口、浏览器插件、网络爬虫、作品下载、云同步、账号系统、多人协作、图片编辑器、多窗口、自动识别图片内容、应用内主动截图工具、从平台自动提取标题作者封面、绕过平台权限或下载平台原始资源。

## 2. 产品模块划分

### Dashboard 首页

功能职责：展示最近更新的项目、最近收藏的灵感卡片、最近创建或编辑的拍摄计划，并提供进入核心模块的快捷入口。

主要页面：DashboardPage

依赖的数据表：projects、inspiration_cards、shooting_plans、media_assets

依赖的 Tauri commands：list_projects、list_inspiration_cards、list_shooting_plans

### Projects 摄影项目模块

功能职责：创建、编辑、删除摄影项目；查看项目详情；查看项目关联的灵感卡片、技术卡片和拍摄计划；从项目生成拍摄计划。

主要页面：ProjectsPage、ProjectDetailPage

依赖的数据表：projects、inspiration_cards、technique_cards、shooting_plans、shooting_plan_inspirations、shooting_plan_techniques

依赖的 Tauri commands：create_project、update_project、delete_project、get_project、list_projects、list_inspiration_cards、list_technique_cards、list_shooting_plans、generate_shooting_plan_from_project

### Inspiration Library 灵感卡片库

功能职责：创建、编辑、删除灵感卡片；保存来源平台、原作品链接、作者、备注；关联项目、标签和本地图片资源；支持按项目、平台、标签、关键词筛选。

主要页面：InspirationLibraryPage、InspirationDetailPage

依赖的数据表：inspiration_cards、inspiration_card_tags、tags、media_assets、projects

依赖的 Tauri commands：create_inspiration_card、update_inspiration_card、delete_inspiration_card、get_inspiration_card、list_inspiration_cards、attach_tag_to_inspiration、detach_tag_from_inspiration、import_local_image、save_image_bytes、delete_media_asset

### Technique Library 摄影技术卡片库

功能职责：创建、编辑、删除摄影技术卡片；记录摄影课程、技巧、布光、构图、参数、后期思路；关联标签和图片资源；支持按分类、平台、标签、关键词筛选；可被拍摄计划引用。

主要页面：TechniqueLibraryPage、TechniqueDetailPage

依赖的数据表：technique_cards、technique_card_tags、tags、media_assets、shooting_plan_techniques

依赖的 Tauri commands：create_technique_card、update_technique_card、delete_technique_card、get_technique_card、list_technique_cards、attach_tag_to_technique、detach_tag_from_technique、import_local_image、save_image_bytes、delete_media_asset

### Tags 标签管理模块

功能职责：管理系统预设标签和用户自定义标签；支持标签分类和标签颜色；为灵感卡片和技术卡片提供标签选择能力。

主要页面：TagsPage

依赖的数据表：tags、inspiration_card_tags、technique_card_tags

依赖的 Tauri commands：create_custom_tag、update_tag、update_tag_color、delete_tag、list_tags、list_tags_by_usage、attach_tag_to_inspiration、detach_tag_from_inspiration、attach_tag_to_technique、detach_tag_from_technique

### Shooting Plans 拍摄计划模块

功能职责：创建、编辑、删除拍摄计划；从摄影项目生成可编辑计划模板；关联灵感卡片和摄影技术卡片；保存拍摄主题、器材清单、场景清单、动作清单、构图参考、光线参考、后期风格和备注。

主要页面：ShootingPlanPage、ShootingPlanDetailPage

依赖的数据表：shooting_plans、shooting_plan_inspirations、shooting_plan_techniques、projects、inspiration_cards、technique_cards、tags

依赖的 Tauri commands：create_shooting_plan、update_shooting_plan、delete_shooting_plan、get_shooting_plan、list_shooting_plans、generate_shooting_plan_from_project、attach_inspiration_to_plan、detach_inspiration_from_plan、attach_technique_to_plan、detach_technique_from_plan

### Media Assets 本地图片资源模块

功能职责：管理灵感卡片、技术卡片、项目、拍摄计划关联的本地图片；支持本地文件导入、拖拽导入、剪贴板图片保存；统一保存图片元信息；避免文件名冲突。

主要页面：不单独作为主页面，被 InspirationForm、TechniqueForm、ProjectForm、ShootingPlanForm 使用。

依赖的数据表：media_assets

依赖的 Tauri commands：import_local_image、save_clipboard_image、save_image_bytes、delete_media_asset、list_media_assets

### Export Markdown 导出模块

功能职责：将拍摄计划导出为 Markdown 文件；聚合项目、计划、灵感卡片、技术卡片和标签数据；写入用户选择的保存路径。

主要页面：ShootingPlanDetailPage

依赖的数据表：projects、shooting_plans、shooting_plan_inspirations、shooting_plan_techniques、inspiration_cards、technique_cards、tags

依赖的 Tauri commands：export_shooting_plan_markdown

### Settings 设置模块

功能职责：展示应用版本、数据库路径、媒体资源目录、导出目录，并预留备份入口。

主要页面：SettingsPage

依赖的数据表：无强依赖

依赖的 Tauri commands：get_app_data_dir、list_media_assets

## 3. 前端页面结构

DashboardPage：展示最近项目、最近灵感卡片、最近拍摄计划，提供新建项目、新建灵感、进入拍摄计划的入口。

ProjectsPage：展示摄影项目列表，支持创建、搜索、删除项目，点击项目进入 ProjectDetailPage。

ProjectDetailPage：展示项目基础信息、关联灵感卡片、关联技术卡片、关联拍摄计划，支持编辑项目和生成拍摄计划。

InspirationLibraryPage：展示灵感卡片网格，支持创建灵感卡片、项目筛选、平台筛选、标签筛选和关键词搜索。

InspirationDetailPage：展示灵感卡片详情，包括图片、标签、来源链接、作者、备注，支持编辑、删除、打开来源链接、管理标签和图片。

TechniqueLibraryPage：展示摄影技术卡片列表，支持创建技术卡片，按分类、平台、标签、关键词筛选。

TechniqueDetailPage：展示技术卡片详情，包括技术说明、适用场景、器材、参数、灯光、构图、步骤、后期要点，支持编辑、删除、管理标签和图片。

TagsPage：按分类展示所有标签，支持创建自定义标签、编辑标签名称和颜色、删除用户自定义标签。

ShootingPlanPage：展示拍摄计划列表，支持按项目或状态筛选计划，支持创建拍摄计划。

ShootingPlanDetailPage：展示和编辑拍摄计划，管理关联灵感卡片和技术卡片，支持导出 Markdown。

SettingsPage：展示应用配置和本地路径，预留备份与恢复入口。

## 4. React 组件结构

通用组件：

- AppLayout：应用整体布局，包含 Sidebar、Topbar 和页面内容区域
- Sidebar：主导航
- Topbar：顶部标题、搜索入口、当前页面操作
- SearchBar：关键词搜索输入
- EmptyState：空数据状态
- ConfirmDialog：删除确认
- TagBadge：展示标签
- TagSelector：选择和创建标签
- PlatformSelect：选择来源平台
- ImageInput：统一图片输入组件
- ImageDropZone：拖拽图片区域
- ClipboardImagePasteArea：剪贴板图片粘贴区域
- MarkdownPreview：Markdown 内容预览

项目组件：

- ProjectCard：项目列表项
- ProjectForm：新建和编辑项目
- ProjectDetailHeader：项目详情头部
- ProjectReferenceSection：展示项目下关联的灵感、技术和计划

灵感卡片组件：

- InspirationCard：灵感卡片展示
- InspirationGrid：灵感卡片网格
- InspirationForm：灵感卡片表单
- InspirationFilters：灵感筛选栏
- InspirationPicker：在计划中选择灵感卡片

技术卡片组件：

- TechniqueCard：技术卡片展示
- TechniqueGrid：技术卡片网格
- TechniqueForm：技术卡片表单
- TechniqueFilters：技术筛选栏
- TechniqueCategorySelect：技术分类选择
- TechniquePicker：在计划中选择技术卡片

拍摄计划组件：

- ShootingPlanForm：拍摄计划编辑表单
- PlanInspirationPicker：拍摄计划关联灵感选择器
- PlanTechniquePicker：拍摄计划关联技术选择器
- PlanReferenceSection：展示计划引用内容
- PlanExportButton：Markdown 导出按钮

标签组件：

- CustomTagForm：创建自定义标签
- TagColorPicker：标签颜色选择
- TagCategorySelect：标签分类选择

组件关系：

- AppLayout 包含 Sidebar、Topbar 和页面容器
- 页面组件负责数据加载和 Tauri command 调用
- 表单组件负责输入、校验和提交
- Grid 组件负责列表展示
- Picker 组件用于拍摄计划内选择已有灵感或技术卡片
- ImageInput 组合 ImageDropZone 和 ClipboardImagePasteArea
- TagSelector 在 InspirationForm、TechniqueForm、ShootingPlanForm 中复用

## 5. Rust 后端模块结构

建议目录结构：

```text
src-tauri/
  src/
    commands/
      mod.rs
      project_commands.rs
      inspiration_commands.rs
      technique_commands.rs
      tag_commands.rs
      shooting_plan_commands.rs
      media_commands.rs
      export_commands.rs
    db/
      mod.rs
      connection.rs
      migrations.rs
    models/
      mod.rs
      project.rs
      inspiration.rs
      technique.rs
      tag.rs
      shooting_plan.rs
      media_asset.rs
    repositories/
      mod.rs
      project_repository.rs
      inspiration_repository.rs
      technique_repository.rs
      tag_repository.rs
      shooting_plan_repository.rs
      media_repository.rs
    services/
      mod.rs
      project_service.rs
      inspiration_service.rs
      technique_service.rs
      tag_service.rs
      shooting_plan_service.rs
    media/
      mod.rs
      file_store.rs
      image_metadata.rs
      clipboard.rs
    export/
      mod.rs
      markdown_exporter.rs
    errors/
      mod.rs
      app_error.rs
    state.rs
    lib.rs
    main.rs
```

目录职责：

- commands/：暴露给前端调用的 Tauri commands
- db/：数据库连接、初始化、migration
- models/：Rust 数据结构，与数据库表和前端 DTO 对齐
- repositories/：SQLite CRUD 和查询
- services/：业务逻辑，例如生成计划、校验输入、组合查询
- media/：图片保存、文件复制、元数据读取、剪贴板处理
- export/：Markdown 生成和文件写入
- errors/：统一错误类型和错误转换

## 6. Tauri commands 分组设计

### 项目模块 commands

create_project：输入 name、theme、description、location、planned_shooting_time、notes；返回 Project；错误包括参数校验失败、数据库写入失败。

update_project：输入 id 和 project payload；返回 Project；错误包括项目不存在、参数校验失败、数据库更新失败。

delete_project：输入 id；返回 deleted；错误包括项目不存在、数据库删除失败。

get_project：输入 id；返回 Project；错误包括项目不存在、数据库查询失败。

list_projects：输入 keyword 可选；返回 Project[]；错误包括数据库查询失败。

### 灵感卡片 commands

create_inspiration_card：输入 title、source_platform、source_url、author_name、notes、project_id、collected_at、tag_ids、media_asset_ids；返回 InspirationCardDetail；错误包括参数校验失败、项目不存在、标签不存在、数据库写入失败。

update_inspiration_card：输入 id 和 inspiration payload；返回 InspirationCardDetail；错误包括灵感卡片不存在、参数校验失败、数据库更新失败。

delete_inspiration_card：输入 id；返回 deleted；错误包括灵感卡片不存在、数据库删除失败、关联资源删除失败。

get_inspiration_card：输入 id；返回 InspirationCardDetail；错误包括灵感卡片不存在、数据库查询失败。

list_inspiration_cards：输入 project_id、source_platform、tag_ids、keyword、limit、offset；返回 InspirationCardSummary[]；错误包括数据库查询失败。

### 摄影技术卡片 commands

create_technique_card：输入 title、category、description、applicable_scenes、recommended_gear、camera_settings、lighting_setup、composition_method、shooting_steps、post_processing、source_url、source_platform、notes、collected_at、tag_ids、media_asset_ids；返回 TechniqueCardDetail；错误包括参数校验失败、标签不存在、数据库写入失败。

update_technique_card：输入 id 和 technique payload；返回 TechniqueCardDetail；错误包括技术卡片不存在、参数校验失败、数据库更新失败。

delete_technique_card：输入 id；返回 deleted；错误包括技术卡片不存在、数据库删除失败、关联资源删除失败。

get_technique_card：输入 id；返回 TechniqueCardDetail；错误包括技术卡片不存在、数据库查询失败。

list_technique_cards：输入 category、source_platform、tag_ids、keyword、limit、offset；返回 TechniqueCardSummary[]；错误包括数据库查询失败。

### 标签 commands

create_custom_tag：输入 name、category、color；返回 Tag；错误包括标签名称为空、分类无效、同分类下标签重复、数据库写入失败。

update_tag：输入 id、name、category；返回 Tag；错误包括标签不存在、系统预设标签不允许修改分类、同分类下标签重复、数据库更新失败。

update_tag_color：输入 id、color；返回 Tag；错误包括标签不存在、颜色格式无效、数据库更新失败。

delete_tag：输入 id；返回 deleted；错误包括标签不存在、系统预设标签不允许删除、数据库删除失败。

list_tags：输入 category 可选；返回 Tag[]；错误包括数据库查询失败。

list_tags_by_usage：输入 target_type；返回 TagWithUsageCount[]；错误包括 target_type 无效、数据库查询失败。

attach_tag_to_inspiration：输入 inspiration_card_id、tag_id；返回 attached；错误包括灵感卡片不存在、标签不存在、数据库写入失败。

detach_tag_from_inspiration：输入 inspiration_card_id、tag_id；返回 detached；错误包括数据库删除失败。

attach_tag_to_technique：输入 technique_card_id、tag_id；返回 attached；错误包括技术卡片不存在、标签不存在、数据库写入失败。

detach_tag_from_technique：输入 technique_card_id、tag_id；返回 detached；错误包括数据库删除失败。

### 拍摄计划 commands

create_shooting_plan：输入 project_id、title、shooting_theme、gear_list、scene_list、action_list、composition_reference、lighting_reference、post_style、technique_notes、notes、status、inspiration_card_ids、technique_card_ids；返回 ShootingPlanDetail；错误包括项目不存在、参数校验失败、数据库写入失败。

update_shooting_plan：输入 id 和 shooting plan payload；返回 ShootingPlanDetail；错误包括拍摄计划不存在、参数校验失败、数据库更新失败。

delete_shooting_plan：输入 id；返回 deleted；错误包括拍摄计划不存在、数据库删除失败。

get_shooting_plan：输入 id；返回 ShootingPlanDetail；错误包括拍摄计划不存在、数据库查询失败。

list_shooting_plans：输入 project_id、status、keyword；返回 ShootingPlanSummary[]；错误包括数据库查询失败。

generate_shooting_plan_from_project：输入 project_id、inspiration_card_ids、technique_card_ids；返回 ShootingPlanDetail；错误包括项目不存在、引用卡片不存在、数据库写入失败。

attach_inspiration_to_plan：输入 shooting_plan_id、inspiration_card_id；返回 attached；错误包括拍摄计划不存在、灵感卡片不存在、数据库写入失败。

detach_inspiration_from_plan：输入 shooting_plan_id、inspiration_card_id；返回 detached；错误包括数据库删除失败。

attach_technique_to_plan：输入 shooting_plan_id、technique_card_id；返回 attached；错误包括拍摄计划不存在、技术卡片不存在、数据库写入失败。

detach_technique_from_plan：输入 shooting_plan_id、technique_card_id；返回 detached；错误包括数据库删除失败。

### 图片资源 commands

import_local_image：输入 source_path、target_type、target_id、source_type；返回 MediaAsset；错误包括文件不存在、图片格式不支持、图片复制失败、数据库写入失败。

save_clipboard_image：输入 target_type、target_id；返回 MediaAsset；错误包括剪贴板无图片、图片格式不支持、图片保存失败、数据库写入失败。

save_image_bytes：输入 bytes、filename、mime_type、target_type、target_id、source_type；返回 MediaAsset；错误包括图片数据为空、图片格式不支持、图片保存失败、数据库写入失败。

delete_media_asset：输入 id、delete_file；返回 deleted；错误包括资源不存在、文件删除失败、数据库删除失败。

list_media_assets：输入 target_type、target_id；返回 MediaAsset[]；错误包括参数校验失败、数据库查询失败。

### 导出 commands

export_shooting_plan_markdown：输入 shooting_plan_id、target_path；返回 ExportResult，包括 target_path、file_size、exported_at；错误包括拍摄计划不存在、目标路径不可写、Markdown 生成失败、文件写入失败。

## 7. 图片导入与截图上传流程

### 方式一：文件选择器导入

流程：用户点击选择图片 -> 前端通过 Tauri dialog 获取本地文件路径 -> 前端调用 import_local_image -> Rust 校验文件是否存在、格式是否支持 -> Rust 复制图片到应用数据目录 -> Rust 创建 media_assets 记录 -> Rust 返回 MediaAsset -> 前端绑定到当前卡片并展示预览。

MVP 优先级：P0。

### 方式二：拖拽本地图片

流程：用户拖拽图片到 ImageDropZone -> 前端读取图片路径或文件信息 -> 前端调用 import_local_image 或 save_image_bytes -> Rust 保存图片到应用数据目录 -> Rust 创建 media_assets 记录 -> Rust 返回 MediaAsset -> 前端展示预览。

MVP 优先级：P1。

### 方式三：剪贴板截图粘贴

流程：用户使用系统截图工具截图 -> 回到 Shot Muse -> 在图片区域按 Ctrl/Cmd + V -> 前端读取剪贴板图片数据 -> 调用 save_image_bytes 或 save_clipboard_image -> Rust 保存图片到应用数据目录 -> 创建 media_assets 记录 -> 返回 MediaAsset -> 前端展示预览。

MVP 优先级：P1。若实现复杂，不阻塞 P0 主流程。

约束：

- 应用不修改原图
- 应用不上传图片
- 应用不抓取网络图片
- 应用不下载平台原始资源
- 应用只保存用户主动选择、拖拽、截图或复制的图片

## 8. 本地数据目录规划

建议应用数据目录：

```text
ShotMuse/
  database/
    shot_muse.sqlite
  media/
    inspiration/
    technique/
    project/
    plan/
  exports/
  backups/
```

图片命名规则：

```text
{target_type}/{yyyy}/{mm}/{uuid}.{ext}
```

示例：

```text
media/inspiration/2026/06/8f3b6c6c-7e31-4c7c-b9d7-a2232f03d431.png
```

文件名冲突处理：

- 文件名使用 UUID
- 保留原始扩展名
- 如果扩展名缺失，根据 mime_type 推断
- 数据库保存 original_filename

删除卡片后的图片资源处理：

- 删除卡片时，通过 target_type + target_id 查询关联 media_assets
- MVP 可默认删除 media_assets 记录和对应文件
- 如果未来支持多处引用同一图片，需要增加引用计数或关联表

数据库记录存在但文件丢失：

- 前端显示占位图和“文件丢失”提示
- 后端 list_media_assets 可返回 exists 字段
- 用户可以选择重新导入或删除失效资源记录

## 9. Markdown 导出流程

流程：用户打开 ShootingPlanDetailPage -> 点击导出按钮 -> 前端通过文件保存对话框选择保存路径 -> 调用 export_shooting_plan_markdown -> 后端读取 shooting_plans、projects、shooting_plan_inspirations、inspiration_cards、shooting_plan_techniques、technique_cards 和 tags -> 生成 Markdown 内容 -> 写入目标文件 -> 返回 ExportResult。

导出内容包含：

- 项目名称
- 拍摄主题
- 拍摄地点
- 预计拍摄时间
- 器材清单
- 场景清单
- 动作清单
- 构图参考
- 光线参考
- 后期风格
- 使用的摄影技术卡片
- 参考灵感卡片
- 标签
- 备注

## 10. 错误处理策略

后端使用统一 AppError：

- DatabaseError：数据库错误
- NotFound：资源不存在
- FileNotFound：文件不存在
- UnsupportedImageFormat：图片格式不支持
- FileCopyFailed：图片复制失败
- ClipboardImageNotFound：剪贴板无图片
- ExportFailed：Markdown 导出失败
- DeleteResourceFailed：删除资源失败
- ValidationError：参数校验失败

前端错误展示策略：

- 表单校验错误展示在字段附近
- 文件和导出错误使用 toast 或 dialog
- 删除失败提示用户检查文件权限
- 图片丢失显示占位图
- 所有错误信息必须使用用户可理解的中文描述

## 11. 数据备份思路

MVP 不强制实现备份，但保留设计：

- SQLite 数据库可复制到 backups/
- media 文件夹可整体打包
- Markdown 导出作为轻量备份
- 后续可加入“一键导出项目包”
- 项目包可包含项目数据、灵感卡片、技术卡片、标签、拍摄计划和媒体文件
