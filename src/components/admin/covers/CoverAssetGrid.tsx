"use client";

import { Archive, Copy, Pencil, Trash2 } from "lucide-react";

import { Button, FallbackImage } from "@/components/admin/ui";
import type { CoverAsset } from "./types";

type CoverAssetGridProps = {
  assets: CoverAsset[];
  loading?: boolean;
  onEdit: (asset: CoverAsset) => void;
  onDelete: (asset: CoverAsset) => void;
};

function getSourceLabel(source: string) {
  if (source === "upload") return "上传";
  if (source === "manual") return "外链";
  if (source === "ai") return "AI";
  return source;
}

export function CoverAssetGrid({ assets, loading = false, onEdit, onDelete }: CoverAssetGridProps) {
  if (loading) {
    return <p className="py-12 text-center text-sm text-[var(--muted)]">正在加载封面图库...</p>;
  }

  if (assets.length === 0) {
    return <p className="py-12 text-center text-sm text-[var(--muted)]">还没有封面。上传图片或添加一个现有图床链接即可开始。</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {assets.map((asset) => (
        <article key={asset.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="relative aspect-[16/9] bg-[var(--surface-alt)]">
            <FallbackImage
              alt={asset.alt || asset.title || "封面图"}
              className="object-cover"
              fill
              sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
              src={asset.url}
              unoptimized
            />
          </div>
          <div className="space-y-3 p-4">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">{asset.title || asset.alt || "未命名封面"}</h3>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">{asset.url}</p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <span className="rounded-full bg-[var(--surface-alt)] px-2 py-1">{getSourceLabel(asset.source)}</span>
              <span className="rounded-full bg-[var(--surface-alt)] px-2 py-1">{asset.status === "active" ? "可用" : "归档"}</span>
              <span className="rounded-full bg-[var(--surface-alt)] px-2 py-1">使用 {asset.usageCount}</span>
            </div>

            {asset.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {asset.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-md bg-[var(--surface-alt)] px-2 py-1 text-xs text-[var(--muted)]">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard?.writeText(asset.url)}
                title="复制 URL"
              >
                <Copy className="mr-1 h-4 w-4" aria-hidden="true" />
                复制
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onEdit(asset)}>
                <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                编辑
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onDelete(asset)}>
                {asset.status === "active" ? <Archive className="mr-1 h-4 w-4" aria-hidden="true" /> : <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />}
                归档
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
