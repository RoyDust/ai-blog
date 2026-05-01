"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Toolbar } from "@/components/admin/primitives/Toolbar";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Modal } from "@/components/admin/ui";
import { CoverAssetForm } from "./CoverAssetForm";
import { CoverAssetGrid } from "./CoverAssetGrid";
import { CoverUploadDropzone } from "./CoverUploadDropzone";
import type { CoverAsset, CoverAssetListResponse } from "./types";

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }

  return fallback;
}

export function CoverGalleryManager() {
  const [assets, setAssets] = useState<CoverAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "upload" | "manual" | "ai">("all");
  const [editing, setEditing] = useState<CoverAsset | null>(null);
  const [randomizing, setRandomizing] = useState(false);

  const params = useMemo(() => {
    const next = new URLSearchParams({ limit: "60" });
    if (query.trim()) next.set("q", query.trim());
    if (statusFilter !== "all") next.set("status", statusFilter);
    if (sourceFilter !== "all") next.set("source", sourceFilter);
    return next;
  }, [query, sourceFilter, statusFilter]);

  const loadAssets = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/covers?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, "封面图库加载失败"));
      }

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

  const upsertAsset = (asset: CoverAsset) => {
    setAssets((prev) => {
      const exists = prev.some((item) => item.id === asset.id);
      return exists ? prev.map((item) => (item.id === asset.id ? asset : item)) : [asset, ...prev];
    });
    setTotal((prev) => (assets.some((item) => item.id === asset.id) ? prev : prev + 1));
  };

  const archiveAsset = async (asset: CoverAsset) => {
    const confirmed = window.confirm(`归档封面“${asset.title || asset.url}”？已使用的文章不会被清空。`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/covers/${asset.id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, "归档失败"));
      }

      setAssets((prev) => prev.filter((item) => item.id !== asset.id));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success("封面已归档");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "归档失败");
    }
  };

  const randomizeMissingPosts = async () => {
    setRandomizing(true);

    try {
      const response = await fetch("/api/admin/covers/randomize-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishedOnly: true }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, "随机补齐失败"));
      }

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
                <select
                  aria-label="封面状态"
                  className="ui-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                >
                  <option value="all">全部状态</option>
                  <option value="active">可用</option>
                  <option value="archived">归档</option>
                </select>
                <select
                  aria-label="封面来源"
                  className="ui-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}
                >
                  <option value="all">全部来源</option>
                  <option value="upload">上传</option>
                  <option value="manual">外链</option>
                  <option value="ai">AI</option>
                </select>
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
