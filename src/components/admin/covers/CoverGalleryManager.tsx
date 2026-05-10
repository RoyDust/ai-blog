"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";

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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "upload" | "manual" | "ai">("all");
  const [editing, setEditing] = useState<CoverAsset | null>(null);
  const [randomizing, setRandomizing] = useState(false);

  /**
   * 将页面筛选状态转换成图库查询参数。
   *
   * loadAssets 依赖这个 memo，因此筛选变化会自然触发重新拉取。
   */
  const params = useMemo(() => {
    const next = new URLSearchParams({ limit: "60" });
    if (query.trim()) next.set("q", query.trim());
    if (statusFilter !== "all") next.set("status", statusFilter);
    if (sourceFilter !== "all") next.set("source", sourceFilter);
    return next;
  }, [query, sourceFilter, statusFilter]);

  /**
   * 拉取当前筛选下的封面资产列表。
   *
   * 失败时清空本地列表，避免界面继续展示已经与筛选条件不匹配的旧数据。
   */
  const loadAssets = useCallback(async () => {
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
  }, [params]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  /**
   * 将新建或更新后的资产合并回当前列表。
   *
   * 上传、外链新增和编辑弹窗都走这一个入口，保持列表和总数更新策略一致。
   */
  const upsertAsset = (asset: CoverAsset) => {
    setAssets((prev) => {
      const exists = prev.some((item) => item.id === asset.id);
      return exists ? prev.map((item) => (item.id === asset.id ? asset : item)) : [asset, ...prev];
    });
    setTotal((prev) => (assets.some((item) => item.id === asset.id) ? prev : prev + 1));
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

      setAssets((prev) => prev.filter((item) => item.id !== asset.id));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success("封面已归档");
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
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                  <SelectTrigger aria-label="封面状态" className={adminSelectTriggerClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={adminSelectContentClassName}>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="active">可用</SelectItem>
                    <SelectItem value="archived">归档</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as typeof sourceFilter)}>
                  <SelectTrigger aria-label="封面来源" className={adminSelectTriggerClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={adminSelectContentClassName}>
                    <SelectItem value="all">全部来源</SelectItem>
                    <SelectItem value="upload">上传</SelectItem>
                    <SelectItem value="manual">外链</SelectItem>
                    <SelectItem value="ai">AI</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
            trailing={<span className="text-sm text-[var(--muted)]">共 {total} 张</span>}
          />

          <CoverAssetGrid assets={assets} loading={loading} onEdit={setEditing} onDelete={archiveAsset} />
        </section>

        <aside className="space-y-4">
          <WorkspacePanel title="上传封面" description="进入图库后，文章编辑器就能直接选择。">
            <CoverUploadDropzone
              onCreated={(asset) => {
                upsertAsset(asset);
                toast.success("封面已保存到图库");
              }}
            />
          </WorkspacePanel>

          <WorkspacePanel title="添加已有链接" description="适合已经在图床中的旧封面。">
            <CoverAssetForm
              onSaved={(asset) => {
                upsertAsset(asset);
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
            upsertAsset(asset);
            setEditing(null);
            toast.success("封面已更新");
          }}
        />
      </Modal>
    </div>
  );
}
