"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";

import { AdminPagination } from "@/components/admin/primitives/AdminPagination";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Toolbar } from "@/components/admin/primitives/Toolbar";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Modal } from "@/components/admin/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { readApiJson } from "@/lib/admin-api-client";
import { CoverAssetForm } from "./CoverAssetForm";
import { CoverAssetGrid } from "./CoverAssetGrid";
import { CoverUploadDropzone } from "./CoverUploadDropzone";
import type { CoverAsset, CoverAssetListResponse } from "./types";

const adminSelectTriggerClassName = "w-[140px] rounded-xl border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
const adminSelectContentClassName = "rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]";
const coverGalleryMemoryKey = "admin:covers:list-filters";
const statusFilters = ["all", "active", "archived"] as const;
const imageKindFilters = ["all", "uploaded", "ai-generated"] as const;
const pageSizeOptions = [12, 24, 48];

type CoverStatusFilter = (typeof statusFilters)[number];
type CoverImageKindFilter = (typeof imageKindFilters)[number];
type CoverGalleryMemory = {
  query: string;
  statusFilter: CoverStatusFilter;
  imageKindFilter: CoverImageKindFilter;
  page: number;
  pageSize: number;
};

function readPositiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function readCoverGalleryMemory(): CoverGalleryMemory {
  const fallback: CoverGalleryMemory = {
    query: "",
    statusFilter: "all",
    imageKindFilter: "all",
    page: 1,
    pageSize: 24,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(coverGalleryMemoryKey) ?? "{}") as Partial<CoverGalleryMemory>;
    const nextPageSize = readPositiveInteger(parsed.pageSize, fallback.pageSize);

    return {
      query: typeof parsed.query === "string" ? parsed.query : fallback.query,
      statusFilter: statusFilters.includes(parsed.statusFilter as CoverStatusFilter) ? (parsed.statusFilter as CoverStatusFilter) : fallback.statusFilter,
      imageKindFilter: imageKindFilters.includes(parsed.imageKindFilter as CoverImageKindFilter) ? (parsed.imageKindFilter as CoverImageKindFilter) : fallback.imageKindFilter,
      page: readPositiveInteger(parsed.page, fallback.page),
      pageSize: pageSizeOptions.includes(nextPageSize) ? nextPageSize : fallback.pageSize,
    };
  } catch {
    return fallback;
  }
}

function writeCoverGalleryMemory(value: CoverGalleryMemory) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(coverGalleryMemoryKey, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable in private or constrained browser contexts.
  }
}

/**
 * 后台封面图库管理页。
 *
 * 负责列表筛选、上传/外链新增、编辑、归档，以及给无封面文章批量随机补图。
 * 所有持久化写入都通过 /api/admin/covers 系列接口完成。
 */
export function CoverGalleryManager() {
  const [assets, setAssets] = useState<CoverAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CoverStatusFilter>("all");
  const [imageKindFilter, setImageKindFilter] = useState<CoverImageKindFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [editing, setEditing] = useState<CoverAsset | null>(null);
  const [randomizing, setRandomizing] = useState(false);
  const [filtersRestored, setFiltersRestored] = useState(false);

  /**
   * 将页面筛选状态转换成图库查询参数。
   *
   * loadAssets 依赖这个 memo，因此筛选变化会自然触发重新拉取。
   */
  const params = useMemo(() => {
    const next = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (query.trim()) next.set("q", query.trim());
    if (statusFilter !== "all") next.set("status", statusFilter);
    if (imageKindFilter === "uploaded") {
      next.set("source", "upload");
      next.set("generatedByAi", "false");
    } else if (imageKindFilter === "ai-generated") {
      next.set("generatedByAi", "true");
    }
    return next;
  }, [imageKindFilter, page, pageSize, query, statusFilter]);

  /**
   * 拉取当前筛选下的封面资产列表。
   *
   * 失败时清空本地列表，避免界面继续展示已经与筛选条件不匹配的旧数据。
   */
  const loadAssets = useCallback(async () => {
    if (!filtersRestored) {
      return;
    }

    setLoading(true);

    try {
      const data = await readApiJson<{ data?: CoverAssetListResponse }>(await fetch(`/api/admin/covers?${params.toString()}`), "封面图库加载失败");

      const payload = data.data as CoverAssetListResponse;
      setAssets(Array.isArray(payload.items) ? payload.items : []);
      setTotal(Number(payload.total ?? 0));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "封面图库加载失败");
      setAssets([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filtersRestored, params]);

  useEffect(() => {
    const saved = readCoverGalleryMemory();
    setQuery(saved.query);
    setStatusFilter(saved.statusFilter);
    setImageKindFilter(saved.imageKindFilter);
    setPage(saved.page);
    setPageSize(saved.pageSize);
    setFiltersRestored(true);
  }, []);

  useEffect(() => {
    if (!filtersRestored) {
      return;
    }

    writeCoverGalleryMemory({
      query,
      statusFilter,
      imageKindFilter,
      page,
      pageSize,
    });
  }, [filtersRestored, imageKindFilter, page, pageSize, query, statusFilter]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  /**
   * 编辑弹窗保存后，就地替换当前页中的对应卡片。
   *
   * 资产仍在可见页内，只是字段更新，无需重新拉取，避免列表闪烁。
   */
  const patchAsset = (asset: CoverAsset) => {
    setAssets((prev) => prev.map((item) => (item.id === asset.id ? asset : item)));
  };

  /**
   * 上传或外链新增成功后回到第一页并刷新。
   *
   * 新资产按创建时间倒序排在最前，跳到第一页才能看到它；分页下不能再做本地乐观插入。
   */
  const handleCreated = () => {
    if (page === 1) {
      void loadAssets();
    } else {
      setPage(1);
    }
  };

  /**
   * 归档图库资产。
   *
   * 后端只把资产标记为归档，不会清空已经使用该封面的文章引用。
   */
  const archiveAsset = async (asset: CoverAsset) => {
    const confirmed = window.confirm(`归档封面“${asset.title || asset.url}”？已使用的文章不会被清空。`);
    if (!confirmed) return;

    try {
      await readApiJson(await fetch(`/api/admin/covers/${asset.id}`, { method: "DELETE" }), "归档失败");
      toast.success("封面已归档");

      if (assets.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        void loadAssets();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "归档失败");
    }
  };

  /**
   * 批量给已发布且缺少封面的文章随机补齐封面。
   *
   * 该动作会修改文章数据，所以只由管理页显式按钮触发，并在完成后刷新图库状态。
   */
  const randomizeMissingPosts = async () => {
    setRandomizing(true);

    try {
      const data = await readApiJson<{ data?: { updated?: number; skippedReason?: string } }>(await fetch("/api/admin/covers/randomize-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishedOnly: true }),
      }), "随机补齐失败");

      const updated = Number(data.data?.updated ?? 0);
      const skippedReason = data.data?.skippedReason;
      toast.success(skippedReason === "NO_ACTIVE_COVERS" ? "暂无可用封面" : `已补齐 ${updated} 篇文章封面`);
      void loadAssets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "随机补齐失败");
    } finally {
      setRandomizing(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Media"
        title="封面图库"
        description="集中管理文章封面，上传后的图片可以在编辑器中直接复用。"
        action={
          <Button type="button" size="sm" variant="outline" onClick={randomizeMissingPosts} disabled={randomizing}>
            <Wand2 className="mr-1 h-4 w-4" aria-hidden="true" />
            {randomizing ? "补齐中..." : "随机补齐无图文章"}
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <Toolbar
            leading={
              <>
                <input
                  aria-label="搜索封面"
                  className="ui-ring min-w-[240px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  placeholder="搜索标题、URL、标签"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
                <Select value={statusFilter} onValueChange={(value) => {
                  setStatusFilter(value as typeof statusFilter);
                  setPage(1);
                }}>
                  <SelectTrigger aria-label="封面状态" className={adminSelectTriggerClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={adminSelectContentClassName}>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="active">可用</SelectItem>
                    <SelectItem value="archived">归档</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={imageKindFilter} onValueChange={(value) => {
                  setImageKindFilter(value as typeof imageKindFilter);
                  setPage(1);
                }}>
                  <SelectTrigger aria-label="图片类型" className={adminSelectTriggerClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={adminSelectContentClassName}>
                    <SelectItem value="all">全部图片</SelectItem>
                    <SelectItem value="uploaded">上传图片</SelectItem>
                    <SelectItem value="ai-generated">AI 生成</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
            trailing={<span className="text-sm text-[var(--muted)]">共 {total} 张</span>}
          />

          <CoverAssetGrid assets={assets} loading={loading} onEdit={setEditing} onDelete={archiveAsset} />

          {total > 0 ? (
            <AdminPagination
              className="rounded-2xl border border-[var(--border)]"
              disabled={loading}
              itemLabel="张封面"
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
              page={page}
              pageSize={pageSize}
              pageSizeOptions={pageSizeOptions}
              total={total}
              totalPages={Math.max(1, Math.ceil(total / pageSize))}
            />
          ) : null}
        </section>

        <aside className="space-y-4 xl:self-start">
          <WorkspacePanel title="上传封面" description="进入图库后，文章编辑器就能直接选择。" fillHeight={false}>
            <CoverUploadDropzone
              onCreated={() => {
                handleCreated();
                toast.success("封面已保存到图库");
              }}
            />
          </WorkspacePanel>

          <WorkspacePanel title="添加已有链接" description="适合已经在图床中的旧封面。" fillHeight={false}>
            <CoverAssetForm
              onSaved={() => {
                handleCreated();
                toast.success("封面已加入图库");
              }}
            />
          </WorkspacePanel>
        </aside>
      </div>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="编辑封面" size="2xl">
        <CoverAssetForm
          asset={editing}
          onCancel={() => setEditing(null)}
          onSaved={(asset) => {
            patchAsset(asset);
            setEditing(null);
            toast.success("封面已更新");
          }}
        />
      </Modal>
    </div>
  );
}
