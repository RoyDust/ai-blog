"use client";

import { useEffect, useState } from "react";

import { Button, Input } from "@/components/admin/ui";
import type { CoverAsset } from "./types";

type CoverAssetFormProps = {
  asset?: CoverAsset | null;
  onSaved: (asset: CoverAsset) => void;
  onCancel?: () => void;
};

function splitTags(value: string) {
  return value
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function CoverAssetForm({ asset, onSaved, onCancel }: CoverAssetFormProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [alt, setAlt] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("active");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUrl(asset?.url ?? "");
    setTitle(asset?.title ?? "");
    setAlt(asset?.alt ?? "");
    setDescription(asset?.description ?? "");
    setTags(asset?.tags?.join(", ") ?? "");
    setStatus(asset?.status ?? "active");
    setError("");
  }, [asset]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const endpoint = asset ? `/api/admin/covers/${asset.id}` : "/api/admin/covers";
      const payload = asset
        ? { title, alt, description, tags: splitTags(tags), status }
        : { url, provider: "manual", source: "manual", title, alt, description, tags: splitTags(tags) };
      const response = await fetch(endpoint, {
        method: asset ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "保存封面失败");
      }

      onSaved(data.data);

      if (!asset) {
        setUrl("");
        setTitle("");
        setAlt("");
        setDescription("");
        setTags("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存封面失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {!asset ? (
        <Input
          label="图片 URL"
          placeholder="https://cdn.example.com/covers/image.jpg"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Input label="标题" placeholder="后台识别名称" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Input label="替代文本" placeholder="用于图片 alt" value={alt} onChange={(event) => setAlt(event.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor={asset ? "edit-cover-description" : "new-cover-description"}>
          备注
        </label>
        <textarea
          id={asset ? "edit-cover-description" : "new-cover-description"}
          className="ui-ring min-h-24 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          placeholder="记录适合的文章主题、风格或使用注意事项"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <Input label="标签" placeholder="tech, hero, dark" value={tags} onChange={(event) => setTags(event.target.value)} />
        {asset ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="cover-status">
              状态
            </label>
            <select
              id="cover-status"
              className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="active">可用</option>
              <option value="archived">归档</option>
            </select>
          </div>
        ) : null}
      </div>

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting || (!asset && !url.trim())}>
          {submitting ? "保存中..." : asset ? "保存封面" : "加入图库"}
        </Button>
      </div>
    </form>
  );
}
