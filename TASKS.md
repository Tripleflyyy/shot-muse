# Shot Muse 开发任务拆分

## P0：先跑通主流程

P0 目标：用户可以创建摄影项目，添加灵感卡片，添加标签，导入本地图片，创建拍摄计划，关联灵感卡片，并导出 Markdown。

P0 暂不要求：技术卡片完整实现、剪贴板截图粘贴、拖拽图片、高级筛选、标签颜色编辑、多图 UI、AI 功能。

## P0 任务

### P0-01 项目初始化方案

优先级：P0

任务目标：明确 Tauri v2 + React + TypeScript + Rust + SQLite 的项目初始化方案，固定目录结构、依赖选择、命名规范。

输入：PRD、ARCHITECTURE.md、DB_SCHEMA.md

输出：初始化命令说明、推荐依赖清单、目录结构说明

涉及文件或模块：package.json、vite.config.ts、src-tauri/Cargo.toml、src/、src-tauri/src/

验收标准：后续 Codex 可按文档初始化项目；不包含业务实现。

是否可并行：否

依赖任务：无

### P0-02 基础页面布局

优先级：P0

任务目标：实现 AppLayout、Sidebar、Topbar，配置基础路由页面。

输入：页面结构设计

输出：可导航的基础空页面

涉及文件或模块：src/app/、src/pages/、src/components/layout/

验收标准：Dashboard、Projects、Inspiration、Tags、Shooting Plans、Settings 可导航；页面无业务数据也能正常显示。

是否可并行：是

依赖任务：P0-01

### P0-03 SQLite 初始化与 migration

优先级：P0

任务目标：初始化 SQLite 数据库，创建 P0 所需表，初始化预设标签。

输入：DB_SCHEMA.md

输出：数据库连接模块、migration 模块、默认标签初始化逻辑

涉及文件或模块：src-tauri/src/db/、src-tauri/src/models/、src-tauri/src/repositories/

验收标准：应用启动后可创建数据库表；默认标签只初始化一次；外键约束开启。

是否可并行：是

依赖任务：P0-01

### P0-04 projects CRUD

优先级：P0

任务目标：实现摄影项目增删改查。

输入：projects 表结构、project commands 设计

输出：Rust repository、Rust service、Tauri commands、前端 projectApi

涉及文件或模块：project_commands.rs、project_repository.rs、project_service.rs、models/project.rs、src/services/projectApi.ts

验收标准：可创建、编辑、删除、查询项目；删除项目时关联拍摄计划级联删除；灵感卡片 project_id 置空。

是否可并行：是

依赖任务：P0-03

### P0-05 tags CRUD

优先级：P0

任务目标：实现标签列表、自定义标签创建、编辑、删除，支持预设标签初始化。

输入：tags 表结构、默认标签清单

输出：tag commands、tag repository、tag service、前端 tagApi

涉及文件或模块：tag_commands.rs、tag_repository.rs、tag_service.rs、models/tag.rs、src/services/tagApi.ts

验收标准：可列出全部标签；可按分类列出标签；可创建自定义标签；预设标签不可删除；同分类标签不可重名。

是否可并行：是

依赖任务：P0-03

### P0-06 inspiration_cards CRUD

优先级：P0

任务目标：实现灵感卡片增删改查，支持关联项目和标签。

输入：inspiration_cards 表结构、inspiration_card_tags 表结构

输出：inspiration commands、inspiration repository、inspiration service、前端 inspirationApi

涉及文件或模块：inspiration_commands.rs、inspiration_repository.rs、inspiration_service.rs、models/inspiration.rs、src/services/inspirationApi.ts

验收标准：可创建、编辑、删除、查询灵感卡片；可绑定项目；可绑定多个标签；可按项目、平台、关键词基础筛选。

是否可并行：是

依赖任务：P0-03、P0-04、P0-05

### P0-07 media_assets 基础能力

优先级：P0

任务目标：实现媒体资源表的基础 CRUD，支持 target_type + target_id 查询。

输入：media_assets 表结构

输出：media repository、media model、media commands 基础实现

涉及文件或模块：media_commands.rs、media_repository.rs、models/media_asset.rs、media/file_store.rs

验收标准：可创建 media_assets 记录；可查询某个目标关联图片；可删除 media_assets 记录。

是否可并行：是

依赖任务：P0-03

### P0-08 本地图片导入

优先级：P0

任务目标：支持从本地文件选择器导入图片，复制图片到应用数据目录，创建 media_assets 记录。

输入：本地数据目录规划、import_local_image command 设计

输出：import_local_image command、文件复制逻辑、图片格式校验

涉及文件或模块：media_commands.rs、media/file_store.rs、media/image_metadata.rs、src/components/common/ImageInput.tsx

验收标准：用户可选择本地图片作为灵感卡片图片；图片被复制到 media/inspiration/；数据库保存 media_assets 记录；不修改原图。

是否可并行：是

依赖任务：P0-07

### P0-09 shooting_plans 基础 CRUD

优先级：P0

任务目标：实现拍摄计划创建、编辑、删除、查询，支持按项目查询计划。

输入：shooting_plans 表结构

输出：shooting_plan commands、shooting_plan repository、shooting_plan service、前端 shootingPlanApi

涉及文件或模块：shooting_plan_commands.rs、shooting_plan_repository.rs、shooting_plan_service.rs、models/shooting_plan.rs

验收标准：可创建拍摄计划；可编辑计划字段；可按项目查询计划；可删除拍摄计划。

是否可并行：是

依赖任务：P0-03、P0-04

### P0-10 shooting_plan_inspirations 关联

优先级：P0

任务目标：支持拍摄计划关联灵感卡片，支持取消关联。

输入：shooting_plan_inspirations 表结构

输出：attach_inspiration_to_plan、detach_inspiration_from_plan、PlanInspirationPicker

涉及文件或模块：shooting_plan_commands.rs、shooting_plan_repository.rs、PlanInspirationPicker.tsx

验收标准：一个计划可关联多个灵感卡片；删除计划时关联记录自动删除；删除灵感卡片时关联记录自动删除。

是否可并行：是

依赖任务：P0-06、P0-09

### P0-11 Markdown 导出

优先级：P0

任务目标：将拍摄计划导出为 Markdown，包含项目、计划、灵感卡片和标签信息。

输入：Markdown 导出流程、shooting plan 数据结构

输出：export_shooting_plan_markdown command、markdown_exporter.rs、PlanExportButton

涉及文件或模块：export_commands.rs、export/markdown_exporter.rs、PlanExportButton.tsx

验收标准：用户可选择保存路径；成功生成 .md 文件；Markdown 内容包含项目和计划核心字段；包含关联灵感卡片链接。

是否可并行：是

依赖任务：P0-04、P0-06、P0-09、P0-10

### P0-12 基础测试与验收

优先级：P0

任务目标：验证 P0 主流程，编写手动验收文档。

输入：P0 功能实现、MVP 验收标准

输出：MANUAL_TEST.md、基础构建检查记录

涉及文件或模块：README.md、MANUAL_TEST.md、前端构建、Rust 编译

验收标准：TypeScript 类型检查通过；Rust 编译通过；可完成创建项目 -> 创建灵感 -> 添加标签 -> 导入图片 -> 创建计划 -> 关联灵感 -> 导出 Markdown。

是否可并行：否

依赖任务：P0-02 至 P0-11

## P1：完善摄影技术卡片和图片体验

### P1-01 technique_cards CRUD

优先级：P1

任务目标：实现摄影技术卡片完整增删改查。

输入：technique_cards 表结构

输出：technique commands、technique repository、technique service、TechniqueLibraryPage、TechniqueDetailPage

涉及文件或模块：technique_commands.rs、technique_repository.rs、technique_service.rs、models/technique.rs、TechniqueForm.tsx

验收标准：可创建、编辑、删除、查询技术卡片；可按分类和关键词筛选。

是否可并行：是

依赖任务：P0-03、P0-05

### P1-02 technique_card_tags

优先级：P1

任务目标：支持技术卡片绑定标签。

输入：technique_card_tags 表结构

输出：attach_tag_to_technique、detach_tag_from_technique、TechniqueForm 标签选择

涉及文件或模块：tag_commands.rs、technique_repository.rs、TagSelector.tsx

验收标准：技术卡片可绑定多个标签；删除技术卡片时关联标签记录自动删除。

是否可并行：是

依赖任务：P1-01、P0-05

### P1-03 shooting_plan_techniques

优先级：P1

任务目标：支持拍摄计划关联技术卡片。

输入：shooting_plan_techniques 表结构

输出：attach_technique_to_plan、detach_technique_from_plan、PlanTechniquePicker

涉及文件或模块：shooting_plan_commands.rs、shooting_plan_repository.rs、PlanTechniquePicker.tsx

验收标准：一个计划可关联多个技术卡片；可取消关联；计划详情中可查看关联技术。

是否可并行：是

依赖任务：P1-01、P0-09

### P1-04 技术卡片关联拍摄计划

优先级：P1

任务目标：在拍摄计划表单中选择技术卡片，在计划详情中展示技术卡片。

输入：TechniquePicker、shooting_plan_techniques

输出：技术引用区块、计划详情技术列表

涉及文件或模块：ShootingPlanForm.tsx、PlanReferenceSection.tsx、TechniquePicker.tsx

验收标准：拍摄计划能添加和移除技术卡片；技术卡片标题、分类、说明可在计划详情展示。

是否可并行：是

依赖任务：P1-03

### P1-05 拖拽图片导入

优先级：P1

任务目标：支持拖拽本地图片到 ImageDropZone。

输入：ImageDropZone 组件、import_local_image 或 save_image_bytes command

输出：拖拽导入图片交互

涉及文件或模块：ImageDropZone.tsx、ImageInput.tsx、media_commands.rs

验收标准：拖拽图片后可保存到 media_assets；非图片文件提示格式不支持。

是否可并行：是

依赖任务：P0-08

### P1-06 剪贴板截图粘贴

优先级：P1

任务目标：支持 Ctrl/Cmd + V 粘贴截图。

输入：ClipboardImagePasteArea、save_image_bytes 或 save_clipboard_image

输出：剪贴板图片保存能力

涉及文件或模块：ClipboardImagePasteArea.tsx、media_commands.rs、media/clipboard.rs

验收标准：剪贴板有图片时可保存并预览；剪贴板无图片时提示用户。

是否可并行：是

依赖任务：P0-08

### P1-07 标签颜色

优先级：P1

任务目标：支持编辑标签颜色，标签展示颜色。

输入：tags.color 字段

输出：TagColorPicker、update_tag_color command

涉及文件或模块：TagColorPicker.tsx、tag_commands.rs、TagsPage.tsx

验收标准：用户可修改自定义标签颜色；TagBadge 显示标签颜色。

是否可并行：是

依赖任务：P0-05

### P1-08 高级筛选

优先级：P1

任务目标：支持灵感和技术卡片按多标签、平台、分类、项目、关键词组合筛选。

输入：list_inspiration_cards filter、list_technique_cards filter

输出：InspirationFilters、TechniqueFilters

涉及文件或模块：InspirationFilters.tsx、TechniqueFilters.tsx、repositories 查询逻辑

验收标准：多条件筛选结果正确；清空筛选后恢复全部列表。

是否可并行：是

依赖任务：P0-06、P1-01

### P1-09 技术卡片在 Markdown 中导出

优先级：P1

任务目标：Markdown 导出包含关联技术卡片。

输入：shooting_plan_techniques、technique_cards

输出：Markdown 中的“使用技术”章节

涉及文件或模块：export/markdown_exporter.rs、export_commands.rs

验收标准：导出的 Markdown 包含技术卡片标题、分类、适用场景、参数和步骤。

是否可并行：是

依赖任务：P1-03、P0-11

## P2：后续增强

### P2-01 多图管理

优先级：P2

任务目标：支持卡片多图排序、删除、设为封面。

输入：media_assets

输出：多图 UI

涉及文件或模块：ImageInput.tsx、media_assets 扩展字段

验收标准：一张卡片可管理多张图。

是否可并行：是

依赖任务：P1-05

### P2-02 图片预览增强

优先级：P2

任务目标：支持大图预览和缩放。

输入：media_assets

输出：ImagePreviewModal

涉及文件或模块：ImagePreviewModal.tsx

验收标准：用户可查看大图。

是否可并行：是

依赖任务：P0-08

### P2-03 图片裁剪

优先级：P2

任务目标：支持裁剪导入图片。

输入：media_assets

输出：裁剪 UI

涉及文件或模块：ImageCropper.tsx

验收标准：用户可裁剪并保存新图片。

是否可并行：是

依赖任务：P2-02

### P2-04 图片标注

优先级：P2

任务目标：支持对图片做简单标注。

输入：media_assets

输出：标注工具

涉及文件或模块：ImageAnnotator.tsx

验收标准：用户可添加文字或箭头标注。

是否可并行：是

依赖任务：P2-02

### P2-05 应用内截图按钮

优先级：P2

任务目标：提供“截图并添加”按钮。

输入：系统截图能力调研

输出：截图入口

涉及文件或模块：media/clipboard.rs、ImageInput.tsx

验收标准：用户点击后可完成截图并保存。

是否可并行：是

依赖任务：P1-06

### P2-06 AI 风格分析

优先级：P2

任务目标：后续接入 AI 分析图片风格。

输入：图片资源、AI 服务设计

输出：风格分析结果

涉及文件或模块：待定

验收标准：可生成风格标签建议。

是否可并行：否

依赖任务：P2-02

### P2-07 AI 拍摄计划建议

优先级：P2

任务目标：后续接入 AI 辅助生成拍摄计划。

输入：项目、灵感、技术卡片

输出：AI 计划草稿

涉及文件或模块：待定

验收标准：可生成可编辑计划建议。

是否可并行：否

依赖任务：P1-09

### P2-08 浏览器插件

优先级：P2

任务目标：支持从浏览器快速保存链接。

输入：插件设计

输出：浏览器插件

涉及文件或模块：待定

验收标准：可从浏览器发送链接到 Shot Muse。

是否可并行：否

依赖任务：P0 主流程完成

### P2-09 Deep Link 快速保存

优先级：P2

任务目标：支持通过 Deep Link 打开应用并预填链接。

输入：Tauri deep link 能力

输出：Deep Link handler

涉及文件或模块：src-tauri/、src/services/

验收标准：外部链接可打开 Shot Muse 并进入新建灵感流程。

是否可并行：是

依赖任务：P0-06

### P2-10 项目包导出与备份

优先级：P2

任务目标：支持导出项目数据和媒体资源包。

输入：projects、inspiration_cards、technique_cards、shooting_plans、media_assets

输出：项目包导出功能

涉及文件或模块：export/、media/

验收标准：可导出项目相关数据和图片资源。

是否可并行：是

依赖任务：P1 主流程完成

## 多 Codex 会话分工

### Codex A：前端框架与基础页面

负责：React Router、AppLayout、Sidebar、DashboardPage、ProjectsPage、InspirationLibraryPage、TagsPage、ShootingPlanPage、基础组件。

主要任务：P0-01、P0-02、部分 P0-12

依赖：等待初始化方案确定后开始。

### Codex B：Rust + SQLite 数据层

负责：SQLite 初始化、migrations、Rust models、repositories、Tauri commands、projects / tags / inspiration / shooting_plans CRUD。

主要任务：P0-03、P0-04、P0-05、P0-06、P0-09、P0-10

依赖：P0-01。

### Codex C：图片资源与导出

负责：media_assets、本地图片导入、应用数据目录、文件复制、文件名冲突处理、Markdown 导出。

主要任务：P0-07、P0-08、P0-11、P1-05、P1-06、P1-09

依赖：P0-03、P0-04、P0-06、P0-09。

### Codex D：业务页面与表单

负责：ProjectForm、InspirationForm、TagSelector、ShootingPlanForm、PlanInspirationPicker、关联选择器、筛选逻辑。

主要任务：P0-04 前端部分、P0-05 前端部分、P0-06 前端部分、P0-10 前端部分、P1-01、P1-02、P1-03、P1-04、P1-08

依赖：Codex A 基础页面、Codex B commands。

### Codex E：测试、文档与验收

负责：运行前端构建、运行 Tauri dev、检查 TypeScript 类型、检查 Rust 编译、更新 README、编写 MANUAL_TEST.md、根据 MVP 验收标准逐项测试。

主要任务：P0-12、P1 验收、P2 规划维护

依赖：P0 主流程完成。
