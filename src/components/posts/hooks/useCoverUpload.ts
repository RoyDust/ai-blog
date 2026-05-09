"use client";

import { useRef, useState } from "react";

import { compressImageForUpload } from "@/lib/client-image-compression";

type CoverUploadResult = {
  coverAssetId: string;
  coverImage: string;
};

/**
 * Runs the full cover upload pipeline: browser compression, Qiniu token request,
 * direct object upload, then cover asset registration in the admin library.
 */
export function useCoverUpload(onUploadSuccess: (result: CoverUploadResult) => void) {
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState("");

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsCoverUploading(true);
    setCoverUploadError("");

    try {
      const compressed = await compressImageForUpload(file, "cover");
      const uploadFile = compressed.file;
      const tokenResponse = await fetch("/api/admin/uploads/qiniu-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: uploadFile.name, contentType: uploadFile.type || file.type }),
      });
      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.success) {
        throw new Error(tokenData.error || "获取上传凭证失败");
      }

      const payload = new FormData();
      payload.append("file", uploadFile);
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
      const coverUrl = `${normalizedDomain}/${tokenData.data.key}`;
      const assetResponse = await fetch("/api/admin/covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: coverUrl,
          key: tokenData.data.key,
          provider: "qiniu",
          source: "upload",
          title: file.name.replace(/\.[^.]+$/, ""),
        }),
      });
      const assetData = await assetResponse.json();

      if (!assetResponse.ok || !assetData.success) {
        throw new Error(assetData.error || "保存到封面图库失败");
      }

      onUploadSuccess({
        coverImage: coverUrl,
        coverAssetId: String(assetData.data.id ?? ""),
      });
    } catch (uploadErrorValue) {
      setCoverUploadError(uploadErrorValue instanceof Error ? uploadErrorValue.message : "上传失败");
    } finally {
      setIsCoverUploading(false);
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = "";
      }
    }
  };

  return {
    coverFileInputRef,
    coverUploadError,
    handleCoverUpload,
    isCoverUploading,
  };
}
