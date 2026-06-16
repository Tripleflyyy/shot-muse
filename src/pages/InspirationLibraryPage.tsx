import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import {
  CardType,
  createInspirationCard,
  deleteInspirationCard,
  InspirationCard,
  InspirationCardPayload,
  listInspirationCards,
  SourcePlatform,
  updateInspirationCard,
} from "../services/inspirationApi";
import {
  deleteMediaAsset,
  getMediaAssetDisplayUrl,
  importLocalImage,
  listMediaAssetsByTarget,
  MediaAsset,
} from "../services/mediaApi";
import { createCustomTag, listTags, Tag, TagCategory } from "../services/tagApi";

type CardFormState = {
  card_type: CardType;
  title: string;
  source_platform: SourcePlatform;
  source_url: string;
  author_name: string;
  notes: string;
  tag_ids: string[];
};

type CardFiltersState = {
  card_type: "all" | CardType;
  source_platform: "" | SourcePlatform;
  keyword: string;
};

type CardModalMode = "create" | "detail" | null;

type PendingCreateImage = {
  sourcePath: string;
  filename: string;
};

const sourcePlatforms: Array<{ value: SourcePlatform; label: string }> = [
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "bilibili", label: "B站" },
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "other", label: "其他" },
];

const cardTypes: Array<{ value: CardType; label: string }> = [
  { value: "inspiration", label: "灵感" },
  { value: "technique", label: "技巧" },
];

const cardTypeTabs: Array<{ value: "all" | CardType; label: string }> = [
  { value: "all", label: "全部" },
  { value: "inspiration", label: "灵感" },
  { value: "technique", label: "技巧" },
];

const tagCategories: Array<{ value: TagCategory; label: string }> = [
  { value: "subject", label: "主体" },
  { value: "lighting", label: "光线" },
  { value: "composition", label: "构图" },
  { value: "color", label: "色彩" },
  { value: "mood", label: "情绪" },
  { value: "technique", label: "技术" },
  { value: "custom", label: "自定义" },
];

const tagColorOptions = [
  { label: "琥珀", value: "#d9902f" },
  { label: "珊瑚", value: "#e76f51" },
  { label: "玫瑰", value: "#d95f8d" },
  { label: "紫藤", value: "#8e7cc3" },
  { label: "天空", value: "#5b8def" },
  { label: "湖蓝", value: "#3aa6b9" },
  { label: "薄荷", value: "#4caf50" },
  { label: "青绿", value: "#2a9d8f" },
  { label: "橄榄", value: "#8aa63f" },
  { label: "石墨", value: "#666666" },
];

const emptyForm: CardFormState = {
  card_type: "inspiration",
  title: "",
  source_platform: "xiaohongshu",
  source_url: "",
  author_name: "",
  notes: "",
  tag_ids: [],
};

const emptyFilters: CardFiltersState = {
  card_type: "all",
  source_platform: "",
  keyword: "",
};

export default function InspirationLibraryPage() {
  const [cards, setCards] = useState<InspirationCard[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<CardFormState>(emptyForm);
  const [filters, setFilters] = useState<CardFiltersState>(emptyFilters);
  const [tagSearchKeyword, setTagSearchKeyword] = useState("");
  const [newTagColor, setNewTagColor] = useState(tagColorOptions[0].value);
  const [isCreatingInlineTag, setIsCreatingInlineTag] = useState(false);
  const [modalMode, setModalMode] = useState<CardModalMode>(null);
  const [selectedCard, setSelectedCard] = useState<InspirationCard | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [pendingDeleteCard, setPendingDeleteCard] =
    useState<InspirationCard | null>(null);
  const [cardMedia, setCardMedia] = useState<Record<string, MediaAsset[]>>({});
  const [pendingRemoveMedia, setPendingRemoveMedia] = useState<{
    cardId: string;
    asset: MediaAsset;
  } | null>(null);
  const [pendingCreateImages, setPendingCreateImages] = useState<PendingCreateImage[]>([]);
  const [imageActionStatus, setImageActionStatus] = useState<{
    cardId: string;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [importingCardId, setImportingCardId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [carouselIndexes, setCarouselIndexes] = useState<Record<string, number>>({});

  const selectedTags = useMemo(
    () =>
      form.tag_ids
        .map((tagId) => tags.find((tag) => tag.id === tagId))
        .filter((tag): tag is Tag => Boolean(tag)),
    [form.tag_ids, tags],
  );

  const selectableTags = useMemo(() => {
    const keyword = tagSearchKeyword.trim().toLowerCase();
    const selectedTagIds = new Set(form.tag_ids);
    const visibleTags = tags.filter((tag) => !selectedTagIds.has(tag.id));

    if (!keyword) {
      return visibleTags;
    }

    return visibleTags.filter((tag) =>
      [tag.name, tag.category, categoryLabel(tag.category)]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [form.tag_ids, tagSearchKeyword, tags]);

  const inlineTagName = tagSearchKeyword.trim();
  const existingInlineTag = useMemo(() => {
    if (!inlineTagName) {
      return null;
    }

    const normalizedName = inlineTagName.toLowerCase();
    return (
      tags.find((tag) => tag.name.trim().toLowerCase() === normalizedName) ?? null
    );
  }, [inlineTagName, tags]);

  const canCreateInlineTag = Boolean(inlineTagName && !existingInlineTag);

  const selectedCardMedia = selectedCard ? cardMedia[selectedCard.id] ?? [] : [];

  useEffect(() => {
    void loadReferenceData();
    void loadCards(emptyFilters);
    // Filters are applied explicitly by the toolbar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hoveredCardId) {
      return;
    }

    const images = cardMedia[hoveredCardId] ?? [];
    if (images.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setCarouselIndexes((current) => ({
        ...current,
        [hoveredCardId]: ((current[hoveredCardId] ?? 0) + 1) % images.length,
      }));
    }, 2000);

    return () => window.clearInterval(timer);
  }, [hoveredCardId, cardMedia]);

  async function loadReferenceData() {
    try {
      setTags(await listTags());
    } catch (error) {
      alert(toErrorMessage(error, "加载标签失败"));
    }
  }

  async function loadCards(nextFilters = filters) {
    setIsLoading(true);
    try {
      const data = await listInspirationCards({
        card_type: nextFilters.card_type === "all" ? null : nextFilters.card_type,
        source_platform: nextFilters.source_platform || null,
        keyword: optionalText(nextFilters.keyword),
        tag_ids: [],
      });
      setCards(data);
      setSelectedCard((current) =>
        current ? data.find((card) => card.id === current.id) ?? current : current,
      );
      await loadMediaForCards(data);
    } catch (error) {
      alert(toErrorMessage(error, "加载卡片失败"));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMediaForCards(nextCards: InspirationCard[]) {
    if (nextCards.length === 0) {
      setCardMedia({});
      return;
    }

    try {
      const entries = await Promise.all(
        nextCards.map(async (card) => [
          card.id,
          await listMediaAssetsByTarget("inspiration", card.id),
        ] as const),
      );
      setCardMedia(Object.fromEntries(entries));
    } catch (error) {
      console.error("加载卡片图片失败", error);
      alert(toErrorMessage(error, "加载卡片图片失败"));
    }
  }

  async function refreshCardMedia(cardId: string) {
    const media = await listMediaAssetsByTarget("inspiration", cardId);
    setCardMedia((current) => ({ ...current, [cardId]: media }));
  }

  function openCreateModal() {
    setForm(emptyForm);
    setTagSearchKeyword("");
    setNewTagColor(tagColorOptions[0].value);
    setPendingDeleteCard(null);
    setPendingRemoveMedia(null);
    setPendingCreateImages([]);
    setSelectedCard(null);
    setIsEditingDetail(false);
    setModalMode("create");
  }

  function openDetailModal(card: InspirationCard) {
    setSelectedCard(card);
    setForm(formFromCard(card));
    setTagSearchKeyword("");
    setNewTagColor(tagColorOptions[0].value);
    setPendingDeleteCard(null);
    setPendingRemoveMedia(null);
    setPendingCreateImages([]);
    setIsEditingDetail(false);
    setModalMode("detail");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedCard(null);
    setIsEditingDetail(false);
    setPendingDeleteCard(null);
    setPendingRemoveMedia(null);
    setImageActionStatus(null);
    setPendingCreateImages([]);
    setTagSearchKeyword("");
    setNewTagColor(tagColorOptions[0].value);
    setForm(emptyForm);
  }

  function startDetailEdit() {
    if (!selectedCard) {
      return;
    }
    setForm(formFromCard(selectedCard));
    setTagSearchKeyword("");
    setNewTagColor(tagColorOptions[0].value);
    setPendingDeleteCard(null);
    setIsEditingDetail(true);
  }

  function cancelDetailEdit() {
    if (selectedCard) {
      setForm(formFromCard(selectedCard));
    }
    setIsEditingDetail(false);
    setPendingDeleteCard(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      alert("卡片标题不能为空");
      return;
    }

    if (!form.source_platform) {
      alert("来源平台不能为空");
      return;
    }

    setIsSaving(true);
    try {
      const payload = toPayload(form);
      if (modalMode === "detail" && selectedCard) {
        const updated = await updateInspirationCard(selectedCard.id, payload);
        setSelectedCard(updated);
        setForm(formFromCard(updated));
        setIsEditingDetail(false);
        await loadCards();
        await refreshCardMedia(updated.id);
      } else {
        const created = await createInspirationCard(payload);
        if (pendingCreateImages.length > 0) {
          try {
            for (const image of pendingCreateImages) {
              await importLocalImage(image.sourcePath, "inspiration", created.id);
            }
          } catch (error) {
            console.error("新建卡片图片导入失败", error);
            alert(toErrorMessage(error, "卡片已创建，但图片导入失败"));
          }
        }
        closeModal();
        await loadCards();
      }
    } catch (error) {
      alert(
        toErrorMessage(
          error,
          modalMode === "detail" ? "编辑卡片失败" : "创建卡片失败",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function requestDeleteCard(card: InspirationCard) {
    if (!card.id) {
      alert("删除卡片失败：卡片 ID 为空");
      return;
    }

    setPendingDeleteCard(card);
  }

  async function confirmDeleteCard() {
    if (!pendingDeleteCard?.id) {
      alert("删除卡片失败：卡片 ID 为空");
      return;
    }

    const card = pendingDeleteCard;

    try {
      await deleteInspirationCard(card.id);
      closeModal();
      await loadCards();
    } catch (error) {
      console.error("删除卡片失败", error);
      alert(toErrorMessage(error, "删除卡片失败"));
    }
  }

  async function handleAddImage(card: InspirationCard) {
    setImageActionStatus({
      cardId: card.id,
      message: "正在打开文件选择器...",
    });

    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "图片",
            extensions: ["jpg", "jpeg", "png", "webp"],
          },
        ],
      });

      if (!selected) {
        setImageActionStatus({
          cardId: card.id,
          message: "已取消选择图片",
        });
        return;
      }

      const sourcePath = Array.isArray(selected) ? selected[0] : selected;
      if (!sourcePath) {
        setImageActionStatus({
          cardId: card.id,
          message: "未选择图片",
        });
        return;
      }

      setImportingCardId(card.id);
      await importLocalImage(sourcePath, "inspiration", card.id);
      await refreshCardMedia(card.id);
      setImageActionStatus({
        cardId: card.id,
        message: "图片导入成功",
      });
      await loadCards();
    } catch (error) {
      console.error("导入图片失败", error);
      const message = toErrorMessage(error, "导入图片失败");
      setImageActionStatus({
        cardId: card.id,
        message,
      });
      alert(message);
    } finally {
      setImportingCardId(null);
    }
  }

  async function handleAddPendingCreateImage() {
    setImageActionStatus({
      cardId: "new-card",
      message: "正在打开文件选择器...",
    });

    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "图片",
            extensions: ["jpg", "jpeg", "png", "webp"],
          },
        ],
      });

      if (!selected) {
        setImageActionStatus({
          cardId: "new-card",
          message: "已取消选择图片",
        });
        return;
      }

      const sourcePath = Array.isArray(selected) ? selected[0] : selected;
      if (!sourcePath) {
        setImageActionStatus({
          cardId: "new-card",
          message: "未选择图片",
        });
        return;
      }

      setPendingCreateImages((current) => [
        ...current,
        {
          sourcePath,
          filename: fileNameFromPath(sourcePath),
        },
      ]);
      setImageActionStatus({
        cardId: "new-card",
        message: "图片已选择，创建卡片后会自动导入",
      });
    } catch (error) {
      console.error("选择图片失败", error);
      const message = toErrorMessage(error, "选择图片失败");
      setImageActionStatus({
        cardId: "new-card",
        message,
      });
      alert(message);
    }
  }

  function removePendingCreateImage(sourcePath: string) {
    setPendingCreateImages((current) =>
      current.filter((image) => image.sourcePath !== sourcePath),
    );
  }

  function requestRemoveMedia(cardId: string, asset: MediaAsset) {
    setPendingRemoveMedia({ cardId, asset });
  }

  async function confirmRemoveMedia() {
    if (!pendingRemoveMedia) {
      return;
    }

    const { cardId, asset } = pendingRemoveMedia;

    try {
      await deleteMediaAsset(asset.id);
      setPendingRemoveMedia(null);
      await refreshCardMedia(cardId);
      setImageActionStatus({
        cardId,
        message: "图片已从卡片移除",
      });
      await loadCards();
    } catch (error) {
      console.error("移除图片失败", error);
      const message = toErrorMessage(error, "移除图片失败");
      setImageActionStatus({
        cardId,
        message,
      });
      alert(message);
    }
  }

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadCards(filters);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    void loadCards(emptyFilters);
  }

  function toggleFormTag(tagId: string) {
    setForm((current) => ({
      ...current,
      tag_ids: current.tag_ids.includes(tagId)
        ? current.tag_ids.filter((id) => id !== tagId)
        : [...current.tag_ids, tagId],
    }));
  }

  function removeFormTag(tagId: string) {
    setForm((current) => ({
      ...current,
      tag_ids: current.tag_ids.filter((id) => id !== tagId),
    }));
  }

  function addFormTag(tagId: string) {
    setForm((current) => ({
      ...current,
      tag_ids: current.tag_ids.includes(tagId)
        ? current.tag_ids
        : [...current.tag_ids, tagId],
    }));
  }

  async function handleCreateInlineTag() {
    const name = inlineTagName;
    if (!name) {
      alert("标签名称不能为空");
      return;
    }

    if (existingInlineTag) {
      addFormTag(existingInlineTag.id);
      setTagSearchKeyword("");
      alert(`标签「${existingInlineTag.name}」已存在，已为你选中`);
      return;
    }

    setIsCreatingInlineTag(true);
    try {
      const created = await createCustomTag({
        name,
        category: "custom",
        color: isValidHexColor(newTagColor) ? newTagColor : tagColorOptions[0].value,
      });
      setTags((current) => [...current, created]);
      addFormTag(created.id);
      setTagSearchKeyword("");
      setNewTagColor(tagColorOptions[0].value);
    } catch (error) {
      console.error("快速新建标签失败", error);
      alert(toErrorMessage(error, "快速新建标签失败"));
    } finally {
      setIsCreatingInlineTag(false);
    }
  }

  function handleCardHover(cardId: string) {
    setHoveredCardId(cardId);
    setCarouselIndexes((current) => ({ ...current, [cardId]: 0 }));
  }

  function handleCardLeave(cardId: string) {
    setHoveredCardId((current) => (current === cardId ? null : current));
    setCarouselIndexes((current) => ({ ...current, [cardId]: 0 }));
  }

  return (
    <section className="page-frame">
      <header className="page-header card-library-page-header">
        <div>
          <p className="page-kicker">Card Library</p>
          <h1 className="page-title">卡片库</h1>
          <p className="page-copy">管理摄影灵感与拍摄技巧卡片。</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreateModal}>
          + New Card
        </button>
      </header>

      <section className="list-panel card-library-panel">
        <form
          className="filter-panel search-filter-panel"
          onSubmit={handleFilterSubmit}
        >
          <div className="card-library-tabs" role="tablist" aria-label="卡片类型视图">
            {cardTypeTabs.map((tab) => (
              <button
                aria-selected={filters.card_type === tab.value}
                className={
                  filters.card_type === tab.value
                    ? "card-library-tab card-library-tab--active"
                    : "card-library-tab"
                }
                key={tab.value}
                type="button"
                onClick={() => {
                  const nextFilters = { ...filters, card_type: tab.value };
                  setFilters(nextFilters);
                  void loadCards(nextFilters);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="search-filter-bar">
            <input
              className="search-filter-input"
              value={filters.keyword}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  keyword: event.target.value,
                }))
              }
              placeholder="搜索标题 / 作者 / 备注 / 链接 / 标签..."
            />
            <select
              className="search-filter-select"
              value={filters.source_platform}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  source_platform: event.target.value as "" | SourcePlatform,
                }))
              }
            >
              <option value="">全部平台</option>
              {sourcePlatforms.map((platform) => (
                <option key={platform.value} value={platform.value}>
                  {platform.label}
                </option>
              ))}
            </select>
            <div className="search-filter-actions">
              <button className="search-filter-button" type="submit">
                筛选
              </button>
              <button
                className="search-filter-reset"
                type="button"
                onClick={clearFilters}
              >
                清空
              </button>
            </div>
          </div>
          <p className="filter-result-text">{cards.length} 张卡片</p>
        </form>

        {isLoading ? (
          <p className="muted-text">正在加载卡片...</p>
        ) : cards.length === 0 ? (
          <p className="empty-message">还没有卡片。先保存一张灵感或技巧卡吧。</p>
        ) : (
          <div className="card-library-wall">
            {cards.map((card) => (
              <CardLibraryTile
                card={card}
                carouselIndex={carouselIndexes[card.id] ?? 0}
                key={card.id}
                mediaAssets={cardMedia[card.id] ?? []}
                onHover={() => handleCardHover(card.id)}
                onLeave={() => handleCardLeave(card.id)}
                onOpen={() => openDetailModal(card)}
              />
            ))}
          </div>
        )}
      </section>

      {modalMode && (
        <div className="reference-modal-overlay" role="presentation">
          <section
            aria-labelledby="card-library-modal-title"
            aria-modal="true"
            className="card-library-modal"
            role="dialog"
          >
            <header className="reference-modal-header">
              <div>
                <p className="page-kicker">
                  {modalMode === "create" ? "New Card" : "Card Detail"}
                </p>
                <h2 id="card-library-modal-title">
                  {modalMode === "create"
                    ? "新建卡片"
                    : selectedCard?.title ?? "卡片详情"}
                </h2>
              </div>
              <div className="modal-header-actions">
                {modalMode === "detail" && selectedCard && !isEditingDetail && (
                  <button type="button" onClick={startDetailEdit}>
                    编辑
                  </button>
                )}
                <button
                  aria-label="关闭卡片弹窗"
                  className="reference-modal-close"
                  type="button"
                  onClick={closeModal}
                >
                  ×
                </button>
              </div>
            </header>

            <div className="card-library-modal-body">
              {modalMode === "create" || isEditingDetail ? (
                <CardForm
                  form={form}
                  imageActionStatus={imageActionStatus}
                  importingCardId={importingCardId}
                  isCreate={modalMode === "create"}
                  isSaving={isSaving}
                  mediaAssets={selectedCardMedia}
                  pendingCreateImages={pendingCreateImages}
                  onAddImage={
                    selectedCard
                      ? () => void handleAddImage(selectedCard)
                      : () => void handleAddPendingCreateImage()
                  }
                  onCancel={modalMode === "create" ? closeModal : cancelDetailEdit}
                  onChange={setForm}
                  onRemovePendingCreateImage={removePendingCreateImage}
                  onRemoveMedia={selectedCard ? requestRemoveMedia : undefined}
                  onSubmit={handleSubmit}
                  pendingRemoveMedia={pendingRemoveMedia}
                  canCreateInlineTag={canCreateInlineTag}
                  existingInlineTag={existingInlineTag}
                  isCreatingInlineTag={isCreatingInlineTag}
                  newTagColor={newTagColor}
                  onCreateInlineTag={() => void handleCreateInlineTag()}
                  selectableTags={selectableTags}
                  selectedTags={selectedTags}
                  tagSearchKeyword={tagSearchKeyword}
                  toggleTag={toggleFormTag}
                  onConfirmRemoveMedia={() => void confirmRemoveMedia()}
                  onNewTagColorChange={setNewTagColor}
                  onRemoveTag={removeFormTag}
                  onTagSearchChange={setTagSearchKeyword}
                />
              ) : selectedCard ? (
                <CardDetail
                  card={selectedCard}
                  imageActionStatus={imageActionStatus}
                  importingCardId={importingCardId}
                  mediaAssets={selectedCardMedia}
                  onAddImage={() => void handleAddImage(selectedCard)}
                  onDelete={() => requestDeleteCard(selectedCard)}
                  onRemoveMedia={requestRemoveMedia}
                  pendingDeleteCard={pendingDeleteCard}
                  pendingRemoveMedia={pendingRemoveMedia}
                  onCancelDelete={() => setPendingDeleteCard(null)}
                  onCancelRemoveMedia={() => setPendingRemoveMedia(null)}
                  onConfirmDelete={() => void confirmDeleteCard()}
                  onConfirmRemoveMedia={() => void confirmRemoveMedia()}
                />
              ) : null}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function CardLibraryTile({
  card,
  carouselIndex,
  mediaAssets,
  onHover,
  onLeave,
  onOpen,
}: {
  card: InspirationCard;
  carouselIndex: number;
  mediaAssets: MediaAsset[];
  onHover: () => void;
  onLeave: () => void;
  onOpen: () => void;
}) {
  const coverIndex =
    mediaAssets.length > 0 ? Math.min(carouselIndex, mediaAssets.length - 1) : 0;
  const cover = mediaAssets[coverIndex];

  return (
    <button
      className="card-library-tile"
      type="button"
      onClick={onOpen}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
    >
      <CardCover
        asset={cover}
        imageCount={mediaAssets.length}
        imageIndex={coverIndex}
        title={card.title}
      />
      <span className={`card-type-badge card-type-badge--${card.card_type}`}>
        {cardTypeLabel(card.card_type)}
      </span>
      <div className="card-library-tile-body">
        <div className="card-library-tile-title">
          <h2>{card.title}</h2>
          <span className="platform-pill">{platformLabel(card.source_platform)}</span>
        </div>
        <p className="card-library-meta">
          {card.author_name ? card.author_name : "未填写作者"}
        </p>
        <p className="card-library-summary">
          {card.notes ? truncateText(card.notes, 72) : "暂无描述"}
        </p>
        <div className="tag-chip-list card-library-tags">
          {card.tags.length === 0 ? (
            <span className="muted-text">未添加标签</span>
          ) : (
            card.tags.slice(0, 5).map((tag) => (
              <span className="tag-chip" key={tag.id} style={tagChipStyle(tag)}>
                {tag.name}
              </span>
            ))
          )}
          {card.tags.length > 5 && (
            <span className="card-library-more-tags">+{card.tags.length - 5}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function CardCover({
  asset,
  imageCount,
  imageIndex,
  title,
}: {
  asset?: MediaAsset;
  imageCount: number;
  imageIndex: number;
  title: string;
}) {
  if (!asset) {
    return (
      <div className="card-library-cover card-library-cover--empty">
        <span>暂无图片</span>
      </div>
    );
  }

  const displayUrl = getMediaAssetDisplayUrl(asset);

  return (
    <div className="card-library-cover">
      <img
        alt={asset.original_filename ?? title}
        src={displayUrl}
        onError={(event) => {
          console.error("card cover image load failed", {
            filePath: asset.file_path,
            displayUrl,
            asset,
          });
          event.currentTarget.classList.add("is-broken");
          event.currentTarget
            .closest(".card-library-cover")
            ?.classList.add("is-broken");
        }}
      />
      {imageCount > 1 && (
        <span className="card-library-image-count">
          {imageIndex + 1} / {imageCount}
        </span>
      )}
      <span className="media-load-fallback">图片加载失败</span>
    </div>
  );
}

function CardForm({
  form,
  imageActionStatus,
  importingCardId,
  isCreate,
  canCreateInlineTag,
  existingInlineTag,
  isCreatingInlineTag,
  isSaving,
  mediaAssets,
  newTagColor,
  pendingCreateImages,
  onAddImage,
  onCancel,
  onChange,
  onCreateInlineTag,
  onConfirmRemoveMedia,
  onNewTagColorChange,
  onRemoveMedia,
  onRemovePendingCreateImage,
  onRemoveTag,
  onSubmit,
  pendingRemoveMedia,
  selectableTags,
  selectedTags,
  tagSearchKeyword,
  toggleTag,
  onTagSearchChange,
}: {
  form: CardFormState;
  imageActionStatus: { cardId: string; message: string } | null;
  importingCardId: string | null;
  isCreate: boolean;
  canCreateInlineTag: boolean;
  existingInlineTag: Tag | null;
  isCreatingInlineTag: boolean;
  isSaving: boolean;
  mediaAssets: MediaAsset[];
  newTagColor: string;
  pendingCreateImages: PendingCreateImage[];
  onAddImage?: () => void;
  onCancel: () => void;
  onChange: (updater: CardFormState | ((current: CardFormState) => CardFormState)) => void;
  onCreateInlineTag: () => void;
  onConfirmRemoveMedia: () => void;
  onNewTagColorChange: (color: string) => void;
  onRemoveMedia?: (cardId: string, asset: MediaAsset) => void;
  onRemovePendingCreateImage: (sourcePath: string) => void;
  onRemoveTag: (tagId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pendingRemoveMedia: { cardId: string; asset: MediaAsset } | null;
  selectableTags: Tag[];
  selectedTags: Tag[];
  tagSearchKeyword: string;
  toggleTag: (tagId: string) => void;
  onTagSearchChange: (value: string) => void;
}) {
  return (
    <form className="card-library-form" onSubmit={onSubmit}>
      <div className="field">
        <span>卡片类型</span>
        <div className="card-type-segment card-type-segment--compact" role="group">
          {cardTypes.map((type) => (
            <button
              className={
                form.card_type === type.value
                  ? "card-type-option card-type-option--active"
                  : "card-type-option"
              }
              key={type.value}
              type="button"
              onClick={() =>
                onChange((current) => ({ ...current, card_type: type.value }))
              }
            >
              <strong>{type.label}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="card-library-form-grid">
        <label className="field">
          <span>卡片标题 *</span>
          <input
            value={form.title}
            onChange={(event) =>
              onChange((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="例如：咖啡馆窗边人像参考"
          />
        </label>

        <label className="field">
          <span>来源平台 *</span>
          <select
            value={form.source_platform}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                source_platform: event.target.value as SourcePlatform,
              }))
            }
          >
            {sourcePlatforms.map((platform) => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>原作品链接</span>
          <input
            value={form.source_url}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                source_url: event.target.value,
              }))
            }
            placeholder="https://..."
          />
        </label>

        <label className="field">
          <span>作者</span>
          <input
            value={form.author_name}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                author_name: event.target.value,
              }))
            }
          />
        </label>
      </div>

      <label className="field">
        <span>描述 / 备注</span>
        <textarea
          value={form.notes}
          onChange={(event) =>
            onChange((current) => ({ ...current, notes: event.target.value }))
          }
          rows={4}
        />
      </label>

      <div className="field">
        <span>标签</span>
        <div className="inline-tag-selector">
          <input
            value={tagSearchKeyword}
            onChange={(event) => onTagSearchChange(event.target.value)}
            placeholder="搜索或新建标签..."
          />

          <div className="inline-tag-section">
            <div className="inline-tag-section-title">
              <span>已选标签</span>
              <small>{selectedTags.length} 个</small>
            </div>
            <div className="tag-chip-cloud">
              {selectedTags.length === 0 ? (
                <p className="empty-message">还没有选择标签</p>
              ) : (
                selectedTags.map((tag) => (
                  <button
                    className="tag-manage-chip tag-manage-chip--selected inline-selected-tag"
                    key={tag.id}
                    style={tagChipStyle(tag)}
                    type="button"
                    onClick={() => onRemoveTag(tag.id)}
                  >
                    <span
                      className="tag-chip-color"
                      style={{ backgroundColor: tag.color ?? "#d6d0c7" }}
                    />
                    <span>#{tag.name}</span>
                    <span aria-hidden="true" className="tag-chip-remove">
                      ×
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="inline-tag-section">
            <div className="inline-tag-section-title">
              <span>可选标签</span>
              <small>{selectableTags.length} 个匹配</small>
            </div>
            <div className="tag-chip-cloud">
              {selectableTags.length === 0 ? (
                <p className="empty-message">
                  {tagSearchKeyword.trim()
                    ? "没有匹配的已有标签"
                    : "暂无可选标签"}
                </p>
              ) : (
                selectableTags.map((tag) => (
                  <button
                    className="tag-manage-chip"
                    key={tag.id}
                    style={tagChipStyle(tag)}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                  >
                    <span
                      className="tag-chip-color"
                      style={{ backgroundColor: tag.color ?? "#d6d0c7" }}
                    />
                    <span>#{tag.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {existingInlineTag && !form.tag_ids.includes(existingInlineTag.id) && (
            <div className="inline-tag-create inline-tag-create--existing">
              <div>
                <strong>找到已有标签「{existingInlineTag.name}」</strong>
                <p>点击即可加入当前卡片。</p>
              </div>
              <button type="button" onClick={() => toggleTag(existingInlineTag.id)}>
                选中
              </button>
            </div>
          )}

          {canCreateInlineTag && (
            <div className="inline-tag-create">
              <div className="inline-tag-create-header">
                <div>
                  <strong>创建标签「{tagSearchKeyword.trim()}」</strong>
                  <p>分类默认为自定义，创建后会自动选中。</p>
                </div>
                <span
                  className="tag-chip"
                  style={tagChipStyle({
                    id: "preview",
                    name: tagSearchKeyword.trim(),
                    category: "custom",
                    color: newTagColor,
                    is_preset: false,
                    created_at: "",
                    updated_at: "",
                  })}
                >
                  #{tagSearchKeyword.trim()}
                </span>
              </div>

              <div className="inline-tag-create-controls">
                <div className="tag-color-picker-main">
                  <span
                    aria-hidden="true"
                    className="tag-color-preview-dot"
                    style={{ backgroundColor: newTagColor }}
                  />
                  <label className="tag-color-native-button">
                    调色盘
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(event) => onNewTagColorChange(event.target.value)}
                    />
                  </label>
                  <span className="tag-color-value">{newTagColor}</span>
                </div>
                <div aria-label="常用标签颜色" className="tag-color-palette">
                  {tagColorOptions.map((option) => (
                    <button
                      aria-label={`选择${option.label}`}
                      className={
                        newTagColor.toLowerCase() === option.value.toLowerCase()
                          ? "tag-color-swatch selected"
                          : "tag-color-swatch"
                      }
                      key={option.value}
                      style={{ "--swatch-color": option.value } as CSSProperties}
                      title={option.label}
                      type="button"
                      onClick={() => onNewTagColorChange(option.value)}
                    >
                      {newTagColor.toLowerCase() === option.value.toLowerCase() && (
                        <span className="tag-color-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="secondary-button"
                disabled={isCreatingInlineTag}
                type="button"
                onClick={onCreateInlineTag}
              >
                {isCreatingInlineTag ? "创建中..." : "创建并选中"}
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="media-section">
        <div className="media-section-header">
          <strong>图片</strong>
          {onAddImage ? (
            <button
              type="button"
              onClick={onAddImage}
              disabled={Boolean(importingCardId)}
            >
              {importingCardId ? "导入中..." : "添加图片"}
            </button>
          ) : (
            <span className="media-empty">保存后可添加图片</span>
          )}
        </div>
        {isCreate ? (
          <PendingCreateImageStrip
            imageActionStatus={imageActionStatus}
            images={pendingCreateImages}
            onRemove={onRemovePendingCreateImage}
          />
        ) : (
          <CardMediaStrip
            imageActionStatus={imageActionStatus}
            mediaAssets={mediaAssets}
            onConfirmRemoveMedia={onConfirmRemoveMedia}
            onRemoveMedia={onRemoveMedia}
            pendingRemoveMedia={pendingRemoveMedia}
          />
        )}
      </section>

      <div className="row-actions">
        <button type="button" onClick={onCancel}>
          取消
        </button>
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? "保存中..." : isCreate ? "创建卡片" : "保存修改"}
        </button>
      </div>
    </form>
  );
}

function PendingCreateImageStrip({
  imageActionStatus,
  images,
  onRemove,
}: {
  imageActionStatus: { cardId: string; message: string } | null;
  images: PendingCreateImage[];
  onRemove: (sourcePath: string) => void;
}) {
  return (
    <>
      {imageActionStatus?.cardId === "new-card" && (
        <p className="media-action-status">{imageActionStatus.message}</p>
      )}

      {images.length === 0 ? (
        <p className="media-empty">暂无待上传图片</p>
      ) : (
        <div className="card-media-strip">
          {images.map((image) => {
            const displayUrl = convertFileSrc(image.sourcePath);
            return (
              <div className="media-thumb-item card-media-strip-item" key={image.sourcePath}>
                <div className="media-thumb-image-wrap">
                  <img
                    alt={image.filename}
                    src={displayUrl}
                    onError={(event) => {
                      console.error("pending image preview failed", {
                        sourcePath: image.sourcePath,
                        displayUrl,
                      });
                      event.currentTarget.classList.add("is-broken");
                      event.currentTarget
                        .closest(".media-thumb-image-wrap")
                        ?.classList.add("is-broken");
                    }}
                  />
                  <span className="media-load-fallback">图片预览失败</span>
                </div>
                <div className="media-thumb-meta">
                  <span>{image.filename}</span>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => onRemove(image.sourcePath)}
                  >
                    移除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function CardDetail({
  card,
  imageActionStatus,
  importingCardId,
  mediaAssets,
  onAddImage,
  onCancelDelete,
  onCancelRemoveMedia,
  onConfirmDelete,
  onConfirmRemoveMedia,
  onDelete,
  onRemoveMedia,
  pendingDeleteCard,
  pendingRemoveMedia,
}: {
  card: InspirationCard;
  imageActionStatus: { cardId: string; message: string } | null;
  importingCardId: string | null;
  mediaAssets: MediaAsset[];
  onAddImage: () => void;
  onCancelDelete: () => void;
  onCancelRemoveMedia: () => void;
  onConfirmDelete: () => void;
  onConfirmRemoveMedia: () => void;
  onDelete: () => void;
  onRemoveMedia: (cardId: string, asset: MediaAsset) => void;
  pendingDeleteCard: InspirationCard | null;
  pendingRemoveMedia: { cardId: string; asset: MediaAsset } | null;
}) {
  return (
    <div className="card-detail-content">
      <div className="card-detail-meta-row">
        <span className={`card-type-badge card-type-badge--${card.card_type}`}>
          {cardTypeLabel(card.card_type)}
        </span>
        <span className="platform-pill">{platformLabel(card.source_platform)}</span>
        {card.author_name && <span className="card-library-meta">{card.author_name}</span>}
      </div>

      <section className="media-section">
        <div className="media-section-header">
          <strong>图片</strong>
          <button
            type="button"
            onClick={onAddImage}
            disabled={importingCardId === card.id}
          >
            {importingCardId === card.id ? "导入中..." : "添加图片"}
          </button>
        </div>
        <CardMediaStrip
          imageActionStatus={imageActionStatus}
          mediaAssets={mediaAssets}
          onCancelRemoveMedia={onCancelRemoveMedia}
          onConfirmRemoveMedia={onConfirmRemoveMedia}
          onRemoveMedia={onRemoveMedia}
          pendingRemoveMedia={pendingRemoveMedia}
        />
      </section>

      <div className="card-detail-section">
        <h3>描述 / 备注</h3>
        <p>{card.notes || "暂无描述"}</p>
      </div>

      <div className="card-detail-section">
        <h3>来源</h3>
        <dl className="compact-meta card-detail-meta">
          <div>
            <dt>作者</dt>
            <dd>{card.author_name || "-"}</dd>
          </div>
          <div>
            <dt>收藏时间</dt>
            <dd>{formatDateTime(card.collected_at)}</dd>
          </div>
          <div>
            <dt>链接</dt>
            <dd>
              {card.source_url ? <a href={card.source_url}>{card.source_url}</a> : "-"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card-detail-section">
        <h3>标签</h3>
        <div className="tag-chip-list">
          {card.tags.length === 0 ? (
            <span className="muted-text">未添加标签</span>
          ) : (
            card.tags.map((tag) => (
              <span className="tag-chip" key={tag.id} style={tagChipStyle(tag)}>
                {tag.name}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="plan-detail-actions">
        <button className="danger-button" type="button" onClick={onDelete}>
          删除卡片
        </button>
      </div>

      {pendingDeleteCard?.id === card.id && (
        <div className="inline-confirm">
          <p>确定删除卡片「{card.title}」吗？</p>
          <div className="row-actions">
            <button className="danger-button" type="button" onClick={onConfirmDelete}>
              确认删除
            </button>
            <button type="button" onClick={onCancelDelete}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CardMediaStrip({
  imageActionStatus,
  mediaAssets,
  onCancelRemoveMedia,
  onConfirmRemoveMedia,
  onRemoveMedia,
  pendingRemoveMedia,
}: {
  imageActionStatus: { cardId: string; message: string } | null;
  mediaAssets: MediaAsset[];
  onCancelRemoveMedia?: () => void;
  onConfirmRemoveMedia: () => void;
  onRemoveMedia?: (cardId: string, asset: MediaAsset) => void;
  pendingRemoveMedia: { cardId: string; asset: MediaAsset } | null;
}) {
  return (
    <>
      {imageActionStatus && (
        <p className="media-action-status">{imageActionStatus.message}</p>
      )}

      {mediaAssets.length === 0 ? (
        <p className="media-empty">暂无图片</p>
      ) : (
        <div className="card-media-strip">
          {mediaAssets.map((asset) => {
            const displayUrl = getMediaAssetDisplayUrl(asset);
            return (
              <div className="media-thumb-item card-media-strip-item" key={asset.id}>
                <div className="media-thumb-image-wrap">
                  <img
                    alt={asset.original_filename ?? "卡片图片"}
                    src={displayUrl}
                    onError={(event) => {
                      console.error("image load failed", {
                        filePath: asset.file_path,
                        displayUrl,
                        asset,
                      });
                      event.currentTarget.classList.add("is-broken");
                      event.currentTarget
                        .closest(".media-thumb-image-wrap")
                        ?.classList.add("is-broken");
                    }}
                  />
                  <span className="media-load-fallback">图片加载失败</span>
                </div>
                <div className="media-thumb-meta">
                  <span>{asset.original_filename ?? "本地图片"}</span>
                  {onRemoveMedia && (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => onRemoveMedia(asset.target_id ?? "", asset)}
                    >
                      移除
                    </button>
                  )}
                </div>

                {pendingRemoveMedia?.asset.id === asset.id && (
                  <div className="inline-confirm">
                    <p>
                      确定从卡片中移除图片「
                      {asset.original_filename ?? "本地图片"}」吗？
                    </p>
                    <div className="row-actions">
                      <button
                        className="danger-button"
                        type="button"
                        onClick={onConfirmRemoveMedia}
                      >
                        确认移除
                      </button>
                      <button
                        type="button"
                        onClick={() => onCancelRemoveMedia?.()}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function toPayload(form: CardFormState): InspirationCardPayload {
  return {
    card_type: form.card_type,
    title: form.title,
    source_platform: form.source_platform,
    source_url: optionalText(form.source_url),
    author_name: optionalText(form.author_name),
    notes: optionalText(form.notes),
    project_id: null,
    tag_ids: form.tag_ids,
  };
}

function formFromCard(card: InspirationCard): CardFormState {
  return {
    card_type: card.card_type,
    title: card.title,
    source_platform: card.source_platform,
    source_url: card.source_url ?? "",
    author_name: card.author_name ?? "",
    notes: card.notes ?? "",
    tag_ids: card.tags.map((tag) => tag.id),
  };
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cardTypeLabel(cardType: CardType): string {
  return cardTypes.find((type) => type.value === cardType)?.label ?? "灵感";
}

function platformLabel(platform: SourcePlatform): string {
  return (
    sourcePlatforms.find((item) => item.value === platform)?.label ?? "其他"
  );
}

function categoryLabel(category: TagCategory): string {
  return (
    tagCategories.find((item) => item.value === category)?.label ?? category
  );
}

function tagChipStyle(tag: Tag): CSSProperties {
  const color = isValidHexColor(tag.color) ? tag.color : "#8a6f3d";
  return {
    "--tag-color": color,
    "--tag-bg": softTagBackground(color),
  } as CSSProperties;
}

function isValidHexColor(color: string | null | undefined): color is string {
  return Boolean(color && /^#[0-9A-Fa-f]{6}$/.test(color));
}

function softTagBackground(color: string): string {
  const red = parseInt(color.slice(1, 3), 16);
  const green = parseInt(color.slice(3, 5), 16);
  const blue = parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, 0.12)`;
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? "本地图片";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function toErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message ? `${fallback}：${message}` : fallback;
}
