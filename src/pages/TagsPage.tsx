import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createCustomTag,
  deleteTag,
  listTags,
  Tag,
  TagCategory,
  updateTag,
  updateTagColor,
} from "../services/tagApi";

type TagFormState = {
  name: string;
  category: TagCategory;
  color: string;
};

type TagTypeFilter = "all" | "preset" | "custom";

const tagCategories: Array<{ value: TagCategory; label: string }> = [
  { value: "subject", label: "主体" },
  { value: "lighting", label: "光线" },
  { value: "composition", label: "构图" },
  { value: "color", label: "色彩" },
  { value: "mood", label: "情绪" },
  { value: "technique", label: "技术" },
  { value: "custom", label: "自定义" },
];

const emptyTagForm: TagFormState = {
  name: "",
  category: "custom",
  color: "",
};

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<TagFormState>(emptyTagForm);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | TagCategory>(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState<TagTypeFilter>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteTag, setPendingDeleteTag] = useState<Tag | null>(null);

  const editingTag = useMemo(
    () => tags.find((tag) => tag.id === editingTagId) ?? null,
    [editingTagId, tags],
  );

  const isEditingPreset = isPresetTag(editingTag);

  const filteredGroups = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    const filteredTags = tags.filter((tag) => {
      if (categoryFilter !== "all" && tag.category !== categoryFilter) {
        return false;
      }

      const isPreset = isPresetTag(tag);
      if (typeFilter === "preset" && !isPreset) {
        return false;
      }
      if (typeFilter === "custom" && isPreset) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [tag.name, tag.category, categoryLabel(tag.category)]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });

    return tagCategories
      .map((category) => ({
        ...category,
        tags: filteredTags.filter((tag) => tag.category === category.value),
      }))
      .filter((group) => group.tags.length > 0);
  }, [categoryFilter, searchKeyword, tags, typeFilter]);

  const filteredTagCount = filteredGroups.reduce(
    (total, group) => total + group.tags.length,
    0,
  );

  async function loadTags() {
    setIsLoading(true);
    try {
      const data = await listTags();
      setTags(data);
    } catch (error) {
      alert(toErrorMessage(error, "加载标签失败"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTags();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      alert("标签名称不能为空");
      return;
    }

    if (isEditingPreset) {
      alert("预设标签不可编辑");
      return;
    }

    const color = form.color.trim();
    if (color && !isValidHexColor(color)) {
      alert("颜色格式错误：标签颜色格式必须为 #RRGGBB");
      return;
    }

    setIsSaving(true);
    try {
      if (editingTagId) {
        await updateTag(editingTagId, {
          name: form.name,
          category: isEditingPreset ? editingTag?.category : form.category,
        });
        await updateTagColor(editingTagId, color || null);
      } else {
        await createCustomTag({
          name: form.name,
          category: form.category || "custom",
          color: color || null,
        });
      }

      resetForm();
      await loadTags();
    } catch (error) {
      alert(toErrorMessage(error, editingTagId ? "编辑标签失败" : "创建标签失败"));
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(tag: Tag) {
    setEditingTagId(tag.id);
    setPendingDeleteTag(null);
    setForm({
      name: tag.name,
      category: tag.category,
      color: tag.color ?? "",
    });
  }

  function requestDeleteTag(tag: Tag) {
    if (!tag.id) {
      alert("删除标签失败：标签 ID 为空");
      return;
    }

    if (isPresetTag(tag)) {
      alert("预设标签不可删除");
      return;
    }

    setPendingDeleteTag(tag);
  }

  async function confirmDeleteTag() {
    if (!pendingDeleteTag?.id) {
      alert("删除标签失败：标签 ID 为空");
      return;
    }

    const tag = pendingDeleteTag;

    if (isPresetTag(tag)) {
      alert("预设标签不可删除");
      setPendingDeleteTag(null);
      return;
    }

    try {
      await deleteTag(tag.id);
      if (editingTagId === tag.id) {
        resetForm();
      }
      setPendingDeleteTag(null);
      await loadTags();
    } catch (error) {
      console.error("删除标签失败", error);
      alert(toErrorMessage(error, "删除标签失败"));
    }
  }

  function resetForm() {
    setEditingTagId(null);
    setPendingDeleteTag(null);
    setForm(emptyTagForm);
  }

  return (
    <section className="page-frame">
      <header className="page-header">
        <p className="page-kicker">Tags</p>
        <h1 className="page-title">Tags</h1>
        <p className="page-copy">
          管理系统预设标签和自定义标签。预设标签只展示，不可删除或改分类。
        </p>
      </header>

      <div className="crud-layout">
        <form className="form-panel sticky-form-panel" onSubmit={handleSubmit}>
          <div className="section-heading">
            <h2>{editingTagId ? "标签详情" : "新建自定义标签"}</h2>
            {editingTagId && (
              <button className="text-button" type="button" onClick={resetForm}>
                新建标签
              </button>
            )}
          </div>

          {editingTag && (
            <div className="selected-tag-summary">
              <span
                className="tag-dot"
                style={{ backgroundColor: editingTag.color ?? "#d6d0c7" }}
              />
              <div>
                <strong>#{editingTag.name}</strong>
                <p>
                  {categoryLabel(editingTag.category)} ·{" "}
                  {isEditingPreset ? "预设标签" : "自定义标签"}
                </p>
              </div>
            </div>
          )}

          <label className="field">
            <span>标签名称 *</span>
            <input
              disabled={isEditingPreset}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="例如：清透肤色"
            />
          </label>

          <label className="field">
            <span>分类</span>
            <select
              disabled={isEditingPreset}
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value as TagCategory,
                }))
              }
            >
              {tagCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>颜色</span>
            <input
              disabled={isEditingPreset}
              value={form.color}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  color: event.target.value,
                }))
              }
              placeholder="#FFAA00"
            />
          </label>

          <button
            className="primary-button"
            disabled={isSaving || isEditingPreset}
            type="submit"
          >
            {isSaving ? "保存中..." : editingTagId ? "保存修改" : "创建标签"}
          </button>

          {editingTag && (
            <div className="form-secondary-actions">
              <button
                className="danger-button"
                disabled={isEditingPreset}
                title={isEditingPreset ? "预设标签不可删除" : undefined}
                type="button"
                onClick={() => requestDeleteTag(editingTag)}
              >
                删除标签
              </button>
            </div>
          )}

          {pendingDeleteTag && (
            <div className="inline-confirm">
              <p>确定删除标签「{pendingDeleteTag.name}」吗？</p>
              <div className="row-actions">
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void confirmDeleteTag()}
                >
                  确认删除
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingDeleteTag(null);
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </form>

        <section className="list-panel">
          <div className="section-heading">
            <h2>标签库</h2>
            <button type="button" onClick={() => void loadTags()}>
              刷新
            </button>
          </div>

          <div className="tag-filter-panel">
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="搜索标签名或分类"
            />
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as "all" | TagCategory)
              }
            >
              <option value="all">全部分类</option>
              {tagCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as TagTypeFilter)
              }
            >
              <option value="all">全部类型</option>
              <option value="preset">预设</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          {isLoading ? (
            <p className="muted-text">正在加载标签...</p>
          ) : tags.length === 0 ? (
            <p className="empty-message">暂无标签</p>
          ) : filteredTagCount === 0 ? (
            <p className="empty-message">没有匹配的标签</p>
          ) : (
            <div className="tag-chip-board">
              {filteredGroups.map((group) => (
                <section className="tag-chip-group" key={group.value}>
                  <div className="tag-group-header">
                    <div>
                      <h3>{group.label}</h3>
                      <p>{group.value}</p>
                    </div>
                    <span>{group.tags.length}</span>
                  </div>

                  <div className="tag-chip-cloud">
                    {group.tags.map((tag) => (
                      <button
                        className={
                          editingTagId === tag.id
                            ? "tag-manage-chip tag-manage-chip--selected"
                            : "tag-manage-chip"
                        }
                        key={tag.id}
                        style={{ borderColor: tag.color ?? "#d6d0c7" }}
                        type="button"
                        onClick={() => handleEdit(tag)}
                      >
                        <span
                          className="tag-chip-color"
                          style={{ backgroundColor: tag.color ?? "#d6d0c7" }}
                        />
                        <span>#{tag.name}</span>
                        <small>{isPresetTag(tag) ? "预设" : "自定义"}</small>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function isPresetTag(tag: Tag | null): boolean {
  const value = tag?.is_preset as unknown;
  return value === true || value === 1 || value === "1";
}

function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function categoryLabel(category: TagCategory): string {
  return (
    tagCategories.find((item) => item.value === category)?.label ?? category
  );
}

function toErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message ? `${fallback}：${message}` : fallback;
}
