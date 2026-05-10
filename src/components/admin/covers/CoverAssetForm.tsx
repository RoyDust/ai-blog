"use client";

import { useEffect, useState } from "react";

import { Button, Input } from "@/components/admin/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { readApiJson } from "@/lib/admin-api-client";
import type { CoverAsset } from "./types";

type CoverAssetFormProps = {
  asset?: CoverAsset | null;
  onSaved: (asset: CoverAsset) => void;
  onCancel?: () => void;
};

const adminSelectTriggerClassName = "w-full rounded-xl border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] shadow-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
const adminSelectContentClassName = "rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]";

/**
 * 把用户输入的标签文本拆成后端期望的字符串数组。
 *
 * 同时支持英文逗号、中文逗号和空白分隔，方便从旧素材备注里直接粘贴。
 */
function splitTags(value: string) {
  return value
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * 封面资产新增/编辑表单。
 *
 * 新增模式写入外链封面；编辑模式只修改元信息和状态，避免误改已经被文章引用的 URL。
 */
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

  /**
   * 根据是否传入 asset 决定调用新增或更新接口。
   *
   * 成功后把最新资产交给父级列表做本地合并，表单自身不负责重新拉取整页数据。
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const endpoint = asset ? `/api/admin/covers/${asset.id}` : "/api/admin/covers";
      const payload = asset
        ? { title, alt, description, tags: splitTags(tags), status }
        : { url, provider: "manual", source: "manual", title, alt, description, tags: splitTags(tags) };
      const data = await readApiJson<{ data: CoverAsset }>(await fetch(endpoint, {
        method: asset ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }), "保存封面失败");

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
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="cover-status" className={adminSelectTriggerClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={adminSelectContentClassName}>
                <SelectItem value="active">可用</SelectItem>
                <SelectItem value="archived">归档</SelectItem>
              </SelectContent>
            </Select>
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
