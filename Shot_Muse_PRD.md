# Shot Muse 产品需求文档

## 1. 产品概述

Shot Muse 是一款面向摄影爱好者的跨平台桌面应用，用于收集摄影灵感、记录摄影技术、整理风格标签，并将这些内容转化为可执行的拍摄计划。

用户可以把来自抖音、小红书、B站、YouTube、Instagram 等平台的摄影作品链接、截图、备注保存到本地，也可以记录自己学习到的摄影技巧，例如布光方法、构图方法、相机参数、后期思路等。最终，用户可以基于项目、灵感卡片、技术卡片和标签生成自己的拍摄计划。

第一阶段只做本地 MVP，不接入 AI，不做浏览器插件，不做平台接口，不爬取或下载他人作品。

## 2. 目标用户

- 摄影爱好者
- 摄影学习者
- 独立摄影师
- 内容创作者
- 想系统整理拍摄灵感和摄影知识的人

## 3. 核心价值

Shot Muse 解决的是“灵感分散、知识零碎、策划困难”的问题。

用户可以完成一条完整工作流：

```text
看到作品 -> 保存灵感 -> 记录技术 -> 打标签 -> 归入项目 -> 筛选参考 -> 组合成拍摄计划 -> 导出 Markdown
```

## 4. MVP 功能范围

第一阶段包含：

- 摄影项目管理
- 灵感卡片管理
- 摄影技术卡片管理
- 图片导入与截图上传
- 标签管理
- 自定义标签
- 灵感和技术筛选
- 拍摄计划生成与编辑
- 拍摄计划关联灵感卡片和技术卡片
- Markdown 导出
- SQLite 本地保存

第一阶段不包含：

- AI 自动生成
- 平台接口
- 浏览器插件
- 网络爬虫
- 作品下载
- 云同步
- 账号系统
- 多人协作

## 5. 摄影项目管理

用户可以创建、编辑、删除和查看摄影项目。

项目字段：

- 名称
- 主题
- 描述
- 拍摄地点
- 预计拍摄时间
- 备注
- 创建时间
- 更新时间

项目详情页包含：

- 项目基本信息
- 项目关联的灵感卡片
- 项目关联的摄影技术卡片
- 项目拍摄计划
- 生成拍摄计划入口

## 6. 灵感卡片管理

灵感卡片用于保存作品参考和创意来源。

字段包括：

- 标题
- 来源平台：抖音 / 小红书 / B站 / YouTube / Instagram / 其他
- 原作品链接
- 作者名称
- 本地截图或封面图
- 标签
- 备注
- 所属项目，可选
- 收藏时间
- 创建时间
- 更新时间

用户可以：

- 新建灵感卡片
- 编辑灵感卡片
- 删除灵感卡片
- 为卡片添加截图
- 直接粘贴剪贴板截图作为卡片图片
- 为卡片添加多个标签
- 将卡片归入项目
- 按项目、平台、标签、关键词筛选

## 7. 摄影技术卡片管理

摄影技术卡片用于记录用户学习到的摄影技巧、课程笔记、拍摄方法或后期方法。

它和灵感卡片不同：灵感卡片偏“参考作品”，技术卡片偏“可复用技能”。

技术卡片字段：

- 标题
- 技术分类
- 技术说明
- 适用场景
- 推荐器材
- 相机参数
- 灯光设置
- 构图方法
- 拍摄步骤
- 后期处理要点
- 参考来源链接
- 来源平台：课程 / 书籍 / 抖音 / 小红书 / B站 / YouTube / Instagram / 其他
- 本地示意图或截图
- 标签
- 备注
- 收藏时间
- 创建时间
- 更新时间

技术分类建议：

- 拍摄基础
- 构图
- 布光
- 色彩
- 人像引导
- 场景调度
- 器材使用
- 后期处理
- 商业拍摄
- 其他

用户可以：

- 新建技术卡片
- 编辑技术卡片
- 删除技术卡片
- 导入本地图片作为示意图
- 直接粘贴剪贴板截图作为技术示意图
- 给技术卡片添加标签
- 在拍摄计划中引用技术卡片
- 按分类、标签、关键词筛选技术卡片

## 8. 标签管理与自定义标签

标签用于同时服务灵感卡片、摄影技术卡片和拍摄计划。

系统提供默认标签分类：

- 题材标签
- 光线标签
- 构图标签
- 色彩标签
- 情绪标签
- 技术标签
- 自定义标签

标签字段：

- 标签名称
- 标签分类
- 标签颜色，可选
- 是否为系统预设
- 创建时间
- 更新时间

标签分类枚举：

```text
subject
lighting
composition
color
mood
technique
custom
```

自定义标签规则：

- 用户可以创建任意自定义标签
- 用户可以给自定义标签选择分类
- 如果不选择分类，默认进入“自定义标签”
- 同一分类下标签名称不可重复
- 系统预设标签可以使用，但不建议删除
- 用户创建的标签可以重命名、删除
- 删除标签不会删除卡片，只会解除标签关联

标签使用范围：

- 灵感卡片
- 摄影技术卡片
- 拍摄计划参考内容

## 9. 图片导入与截图上传

用户可以通过两种方式为卡片添加图片：

- 从本地选择已有图片
- 直接使用截图或剪贴板图片

- 灵感卡片截图或封面
- 技术卡片示意图或课程截图

截图上传使用场景：

- 用户在浏览抖音、小红书、B站、YouTube、Instagram 等内容时，使用系统截图工具截取样图
- 用户回到 Shot Muse，在灵感卡片或技术卡片表单中直接粘贴截图
- 应用将剪贴板中的图片保存到应用数据目录，并自动绑定到当前卡片

MVP 支持方式：

- 支持从剪贴板读取图片并保存
- 支持在图片区域使用快捷键粘贴截图
- 支持拖拽本地图片到图片区域
- 支持从文件选择器导入本地图片

后续增强方式：

- 应用内提供“截图并添加”按钮，调用系统截图能力后直接保存图片
- 支持为一张卡片添加多张参考图
- 支持图片裁剪、标注、局部放大

应用行为：

- 将图片复制到应用数据目录
- 数据库保存图片路径
- 不修改原图
- 不上传图片
- 不自动抓取网络图片
- 不绕过平台权限或下载平台原始资源
- 粘贴截图只保存用户主动截取或复制到剪贴板的图片

## 10. 筛选与检索

灵感卡片支持筛选：

- 所属项目
- 来源平台
- 标签
- 关键词

技术卡片支持筛选：

- 技术分类
- 来源平台
- 标签
- 关键词

关键词匹配范围：

- 标题
- 作者
- 备注
- 链接
- 技术说明
- 适用场景
- 后期要点

## 11. 拍摄计划

用户可以基于摄影项目生成拍摄计划。

拍摄计划包括：

- 拍摄主题
- 器材清单
- 场景清单
- 动作清单
- 构图参考
- 光线参考
- 后期风格
- 使用的摄影技术
- 参考灵感卡片
- 备注

生成逻辑：

第一阶段不使用 AI。

系统根据项目基本信息创建一个可编辑模板，并允许用户选择：

- 要参考的灵感卡片
- 要使用的技术卡片
- 要强调的标签

拍摄计划字段：

- 标题
- 所属项目
- 拍摄主题
- 器材清单
- 场景清单
- 动作清单
- 构图参考
- 光线参考
- 后期风格
- 技术应用说明
- 备注
- 创建时间
- 更新时间

## 12. Markdown 导出

用户可以将拍摄计划导出为 Markdown 文件。

导出内容包括：

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

技术卡片导出示例结构：

```md
## 使用技术

### 单灯侧逆光人像

- 分类：布光
- 适用场景：室内窗边人像、夜景人像
- 推荐器材：一盏 LED 灯、柔光箱
- 参数参考：F2.8 / ISO 400 / 1/125s
- 拍摄步骤：...
```

## 13. SQLite 数据结构补充

### technique_cards

```sql
CREATE TABLE technique_cards (
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
  image_path TEXT,
  notes TEXT,
  collected_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### technique_card_tags

```sql
CREATE TABLE technique_card_tags (
  technique_card_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (technique_card_id, tag_id),
  FOREIGN KEY (technique_card_id) REFERENCES technique_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

### shooting_plan_techniques

```sql
CREATE TABLE shooting_plan_techniques (
  shooting_plan_id TEXT NOT NULL,
  technique_card_id TEXT NOT NULL,
  PRIMARY KEY (shooting_plan_id, technique_card_id),
  FOREIGN KEY (shooting_plan_id) REFERENCES shooting_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (technique_card_id) REFERENCES technique_cards(id) ON DELETE CASCADE
);
```

### tags

```sql
CREATE TABLE tags (
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

### shooting_plans 补充字段

```sql
ALTER TABLE shooting_plans ADD COLUMN technique_notes TEXT;
```

## 14. Tauri Commands 补充

摄影技术卡片 commands：

```text
create_technique_card(payload)
update_technique_card(id, payload)
delete_technique_card(id)
get_technique_card(id)
list_technique_cards(filter)
```

技术卡片筛选 filter：

```text
category
source_platform
tag_ids
keyword
```

拍摄计划补充 commands：

```text
generate_shooting_plan_from_project(project_id, inspiration_ids, technique_card_ids)
attach_technique_to_plan(shooting_plan_id, technique_card_id)
detach_technique_from_plan(shooting_plan_id, technique_card_id)
```

标签 commands 补充：

```text
create_custom_tag(payload)
update_tag_color(id, color)
list_tags_by_usage(target_type)
```

图片 commands 可复用：

```text
import_local_image(source_path, target_type)
save_clipboard_image(target_type)
save_image_bytes(payload, target_type)
```

`target_type` 可为：

```text
inspiration
technique
```

截图相关 command 说明：

- `save_clipboard_image(target_type)`：读取系统剪贴板中的图片，保存到应用数据目录，返回图片路径
- `save_image_bytes(payload, target_type)`：前端从粘贴事件或拖拽事件中读取图片数据后，传给 Rust 保存，返回图片路径
- 第一阶段优先实现剪贴板粘贴和拖拽导入
- 应用内主动调用系统截图工具可作为后续增强，不阻塞 MVP

## 15. 页面与组件补充

新增页面：

```text
TechniqueLibraryPage
TechniqueDetailPage
```

新增组件：

```text
TechniqueCard
TechniqueGrid
TechniqueForm
TechniqueFilters
TechniqueCategorySelect
TechniquePicker
TechniqueReferenceList
```

图片输入组件：

```text
ImageInput
ImageDropZone
ClipboardImagePasteArea
ScreenshotPreview
```

拍摄计划页面补充：

```text
PlanInspirationPicker
PlanTechniquePicker
PlanReferenceSection
```

标签组件补充：

```text
CustomTagForm
TagColorPicker
TagCategorySelect
```

## 16. MVP 验收标准

MVP 完成后，用户应能：

1. 创建摄影项目
2. 添加灵感卡片，并通过本地文件、拖拽或剪贴板截图添加图片
3. 添加摄影技术卡片，并通过本地文件、拖拽或剪贴板截图添加示意图
4. 创建和管理系统分类标签、自定义标签
5. 给灵感卡片和技术卡片打标签
6. 按项目、平台、分类、标签、关键词筛选内容
7. 基于项目选择灵感卡片和技术卡片生成拍摄计划
8. 编辑拍摄计划
9. 导出 Markdown 文件
10. 所有数据保存在本地 SQLite 中

## 17. 产品阶段总结

这个版本的 Shot Muse 会从“灵感收集工具”升级成一个更完整的“摄影知识与拍摄策划工作台”。
