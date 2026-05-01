"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/admin/ui";
import type { CoverAsset } from "./types";

type CoverUploadDropzoneProps = {
  onCreated: (asset: CoverAsset) => void;
};

export function CoverUploadDropzone({ onCreated }: CoverUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const tokenResponse = await fetch("/api/admin/uploads/qiniu-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.success) {
        throw new Error(tokenData.error || "获取上传凭证失败");
      }

      const payload = new FormData();
      payload.append("file", file);
      payload.append("token", tokenData.data.token);
      payload.append("key", tokenData.data.key);

      const uploadResponse = await fetch(tokenData.data.uploadUrl, {
        method: "POST",
        body: payload,
      });

      if (!uploadResponse.ok) {
        throw new Error("上传到七牛失败");
      }

      const normalizedDomain = String(tokenData.data.domain).replace(/\/$/, "");
      const url = `${normalizedDomain}/${tokenData.data.key}`;
      const assetResponse = await fetch("/api/admin/covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          key: tokenData.data.key,
          provider: "qiniu",
          source: "upload",
          title: file.name.replace(/\.[^.]+$/, ""),
        }),
      });
      const assetData = await assetResponse.json();

      if (!assetResponse.ok || !assetData.success) {
        throw new Error(assetData.error || "保存到图库失败");
      }

      onCreated(assetData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-alt)] px-4 py-5">
      <input ref={inputRef} accept="image/*" className="hidden" type="file" onChange={handleFileChange} />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-xl bg-[var(--surface)] p-2 text-[var(--brand)]">
            <UploadCloud className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium text-[var(--foreground)]">上传到图床并保存</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">图片会先直传七牛，再写入封面图库。</p>
          </div>
        </div>
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? "上传中..." : "选择图片"}
        </Button>
      </div>
      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
