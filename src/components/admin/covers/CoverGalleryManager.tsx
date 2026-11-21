"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { ListSearchInput, MetricStrip } from "@/components/admin/lists";
import { AdminPagination } from "@/components/admin/primitives/AdminPagination";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { Toolbar } from "@/components/admin/primitives/Toolbar";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Modal } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { readPositiveInteger, useFilterMemory } from "@/hooks/useFilterMemory";
import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";
import { CoverAssetForm } from "./CoverAssetForm";
import { CoverAssetGrid } from "./CoverAssetGrid";
import { CoverUploadDropzone } from "./CoverUploadDropzone";
import type { CoverAsset, CoverAssetListResponse } from "./types";

const adminSelectTriggerClassName = "w-full text-[0.8125rem] sm:w-[124px]";
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

const fallbackCoverGalleryMemory: CoverGalleryMemory = {
  query: "",
  statusFilter: "all",
  imageKindFilter: "all",
  page: 1,
  pageSize: 24,
};

function validateCoverGalleryMemory(
  parsed: Partial<CoverGalleryMemory>,
  fallback: CoverGalleryMemory,
): CoverGalleryMemory {
  const nextPageSize = readPositiveInteger(parsed.pageSize, fallback.pageSize);

  return {
    query: typeof parsed.query === "string" ? parsed.query : fallback.query,
    statusFilter: statusFilters.includes(parsed.statusFilter as CoverStatusFilter)
      ? (parsed.statusFilter as CoverStatusFilter)
      : fallback.statusFilter,
    imageKindFilter: imageKindFilters.includes(parsed.imageKindFilter as CoverImageKindFilter)
      ? (parsed.imageKindFilter as CoverImageKindFilter)
      : fallback.imageKindFilter,
    page: readPositiveInteger(parsed.page, fallback.page),
    pageSize: pageSizeOptions.includes(nextPageSize) ? nextPageSize : fallback.pageSize,
  };
}

function buildCoverGalleryUrl(memory: CoverGalleryMemory): string {
  const next = new URLSearchParams({ page: String(memory.page), limit: String(memory.pageSize) });
  if (memory.query.trim()) next.set("q", memory.query.trim());
  if (memory.statusFilter !== "all") next.set("status", memory.statusFilter);
  if (memory.imageKindFilter === "uploaded") {
    next.set("source", "upload");
    next.set("generatedByAi", "false");
  } else if (memory.imageKindFilter === "ai-generated") {
    next.set("generatedByAi", "true");
  }
  return `/api/admin/covers?${next.toString()}`;
}

function replaceCoverAssetInResponse(
  current: { data?: CoverAssetListResponse } | undefined,
  asset: CoverAsset,
) {
  if (!current?.data) return current;
  return {
    ...current,
    data: {
      ...current.data,
      items: current.data.items.map((item) => (item.id === asset.id ? asset : item)),
    },
  };
}

/**
 * 后台封面图库管理页。
 *
 * 负责列表筛选、上传/外链新增、编辑、归档，以及给无封面文章批量随机补图。
 * 所有持久化写入都通过 /api/admin/covers 系列接口完成。
 */
export function CoverGalleryManager() {
  const { initialMemory, persist } = useFilterMemory(
    coverGalleryMemoryKey,
    fallbackCoverGalleryMemory,
    validateCoverGalleryMemory,
  );
  const [query, setQuery] = useState(initialMemory.query);
  const [statusFilter, setStatusFilter] = useState<CoverStatusFilter>(initialMemory.statusFilter);
  const [imageKindFilter, setImageKindFilter] = useState<CoverImageKindFilter>(initialMemory.imageKindFilter);
  const [page, setPage] = useState(initialMemory.page);
  const [pageSize, setPageSize] = useState(initialMemory.pageSize);
  const [editing, setEditing] = useState<CoverAsset | null>(null);
  const [randomizing, setRandomizing] = useState(false);
  const [archivingAsset, setArchivingAsset] = useState<CoverAsset | null>(null);
  const [archiving, setArchiving] = useState(false);

  const coverUrl = useMemo(
    () => buildCoverGalleryUrl({ query, statusFilter, imageKindFilter, page, pageSize }),
    [imageKindFilter, page, pageSize, query, statusFilter],
  );

  const { data, isLoading: loading, mutate } = useSWR<{ data?: CoverAssetListResponse }>(coverUrl, apiFetcher, {
    keepPreviousData: true,
    revalidateOnMount: true,
    onError: (swrError, key) => {
      handleGlobalSwrError(swrError, key);
      toast.error(toErrorMessage(swrError, "封面图库加载失败"));
    },
  });

  const assets = useMemo(() => data?.data?.items ?? [], [data?.data?.items]);
  const total = data?.data?.total ?? 0;

  useEffect(() => {
    persist({ query, statusFilter, imageKindFilter, page, pageSize });
  }, [imageKindFilter, page, pageSize, persist, query, statusFilter]);

  const patchAsset = (asset: CoverAsset) => {
    void mutate((current) => replaceCoverAssetInResponse(current, asset), { revalidate: false });
  };

  const handleCreated = () => {
    if (page === 1) {
      void mutate();
    } else {
      setPage(1);
    }
  };

  const confirmArchive = async () => {
    if (!archivingAsset) return;

    setArchiving(true);
    try {
      await apiMutate(`/api/admin/covers/${archivingAsset.id}`, { method: "DELETE" });
      toast.success("封面已归档");
      setArchivingAsset(null);

      if (assets.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        void mutate();
      }
    } catch (error) {
      toast.error(toErrorMessage(error, "归档失败"));
    } finally {
      setArchiving(false);
    }
  };

  const randomizeMissingPosts = async () => {
    setRandomizing(true);

    try {
      const result = await apiMutate<{ data?: { updated?: number; skippedReason?: string } }>(
        "/api/admin/covers/randomize-posts",
        {
          method: "POST",
          body: JSON.stringify({ publishedOnly: true }),
        },
      );

      const updated = Number(result.data?.updated ?? 0);
      const skippedReason = result.data?.skippedReason;
      toast.success(skippedReason === "NO_ACTIVE_COVERS" ? "暂无可用封面" : `已补齐 ${updated} 篇文章封面`);
      void mutate();
    } catch (error) {
      toast.error(toErrorMessage(error, "随机补齐失败"));
    } finally {
      setRandomizing(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeOnPage = assets.filter((asset) => asset.status === "active").length;
  const aiOnPage = assets.filter((asset) => asset.generatedByAi).length;

  return (
    <div>
      <PageHeader
        eyebrow="媒体库"
        title="封面图库"
        description="集中管理文章封面，上传后的图片可以在编辑器中直接复用。"
        action={
          <Button type="button" variant="outline" onClick={randomizeMissingPosts} disabled={randomizing}>
            {randomizing ? "补齐中..." : "随机补齐无图文章"}
          </Button>
        }
      />

      <MetricStrip
        ariaLabel="封面图库概况"
        className="mt-1"
        items={[
          { key: "total", label: "匹配封面", value: total.toLocaleString("zh-CN"), note: "当前筛选下的总数" },
          { key: "page", label: "本页", value: assets.length.toLocaleString("zh-CN"), note: `第 ${page} / ${totalPages} 页` },
          { key: "active", label: "本页可用", value: activeOnPage.toLocaleString("zh-CN"), note: "可在编辑器中选择", tone: "success" },
          { key: "ai", label: "本页 AI 生成", value: aiOnPage.toLocaleString("zh-CN"), note: "生图模型产出" },
        ]}
      />

      <div className="mt-6 grid gap-x-8 gap-y-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="admin-covers-title" className="min-w-0">
          <AdminSectionHeader
            aside={
              <span className="ed-mono">
                第 {page} / {totalPages} 页<span className="ed-meta-sep">·</span>共 {total} 张
              </span>
            }
            description="图片、来源、状态与使用次数"
            id="admin-covers-title"
            title="封面列表"
          />
          <Toolbar
            leading={
              <>
                <ListSearchInput
                  ariaLabel="搜索封面"
                  className="sm:w-[260px]"
                  onChange={(value) => {
                    setQuery(value);
                    setPage(1);
                  }}
                  placeholder="搜索标题、URL、标签"
                  value={query}
                />
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as CoverStatusFilter);
                    setPage(1);
                  }}
                >
                  <SelectTrigger aria-label="封面状态" className={adminSelectTriggerClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="active">可用</SelectItem>
                    <SelectItem value="archived">归档</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={imageKindFilter}
                  onValueChange={(value) => {
                    setImageKindFilter(value as CoverImageKindFilter);
                    setPage(1);
                  }}
                >
                  <SelectTrigger aria-label="图片类型" className={adminSelectTriggerClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部图片</SelectItem>
                    <SelectItem value="uploaded">上传图片</SelectItem>
                    <SelectItem value="ai-generated">AI 生成</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />

          <div className="border-t border-[var(--reader-border-strong)] pt-5">
            <CoverAssetGrid assets={assets} loading={loading} onEdit={setEditing} onDelete={setArchivingAsset} />
          </div>

          {total > 0 ? (
            <AdminPagination
              className="mt-5 border-t border-[var(--border)]"
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
              totalPages={totalPages}
            />
          ) : null}
        </section>

        <aside className="space-y-6 xl:self-start">
          <WorkspacePanel title="上传封面" description="进入图库后，文章编辑器就能直接选择。" fillHeight={false} variant="pane">
            <CoverUploadDropzone
              onCreated={() => {
                handleCreated();
                toast.success("封面已保存到图库");
              }}
            />
          </WorkspacePanel>

          <WorkspacePanel title="添加已有链接" description="适合已经在图床中的旧封面。" fillHeight={false} variant="pane">
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

      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="确认归档"
        description={archivingAsset ? `归档封面“${archivingAsset.title || archivingAsset.url}”？已使用的文章不会被清空。` : ""}
        onConfirm={confirmArchive}
        onOpenChange={(open) => {
          if (!open) setArchivingAsset(null);
        }}
        open={Boolean(archivingAsset)}
        submitting={archiving}
        title="归档封面"
        tone="danger"
      />
    </div>
  );
}
