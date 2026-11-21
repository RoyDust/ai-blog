"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/admin/ui";
import { apiMutate, toErrorMessage } from "@/lib/client-api";
import { compressImageForUpload } from "@/lib/client-image-compression";
import { uploadFileToQiniu } from "@/lib/client-qiniu-upload";
import type { CoverAsset } from "./types";

type CoverUploadDropzoneProps = {
  onCreated: (asset: CoverAsset) => void;
};

/**
 * 封面上传入口。
 *
 * 客户端先压缩图片，再申请七牛上传凭证，直传完成后把公开 URL 写入封面图库。
 */
export function CoverUploadDropzone({ onCreated }: CoverUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  /**
   * 处理单张封面上传的完整链路。
   *
   * input value 会在 finally 清空，确保用户可以连续选择同一个文件重试。
   */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const compressed = await compressImageForUpload(file, "cover");
      const uploadFile = compressed.file;
      const { url, key } = await uploadFileToQiniu(uploadFile, {
        contentType: uploadFile.type || file.type,
        purpose: "cover",
      });

      const assetData = await apiMutate<{
        success?: boolean;
        data?: CoverAsset;
      }>("/api/admin/covers", {
        method: "POST",
        body: JSON.stringify({
          url,
          key,
          provider: "qiniu",
          source: "upload",
          title: file.name.replace(/\.[^.]+$/, ""),
        }),
      });

      if (!assetData.data) {
        throw new Error("保存到图库失败");
      }

      onCreated(assetData.data);
    } catch (err) {
      setError(toErrorMessage(err, "上传失败"));
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="rounded-[var(--radius-paper)] border border-dashed border-[var(--reader-border-strong)] px-4 py-4 transition-colors duration-150 hover:border-[var(--text-muted)]">
      <input ref={inputRef} accept="image/*" className="hidden" type="file" onChange={handleFileChange} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.875rem] font-bold text-[var(--foreground)]">上传到图床并保存</p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">图片会先直传七牛，再写入封面图库。</p>
        </div>
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? "上传中..." : "选择图片"}
        </Button>
      </div>
      {error ? (
        <p className="ed-banner ed-banner--danger mt-3" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
