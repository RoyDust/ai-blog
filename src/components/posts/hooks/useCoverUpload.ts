"use client";

import { useRef, useState } from "react";

import { apiMutate, toErrorMessage } from "@/lib/client-api";
import { compressImageForUpload } from "@/lib/client-image-compression";
import { uploadFileToQiniu } from "@/lib/client-qiniu-upload";

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
      const { url: coverUrl, key } = await uploadFileToQiniu(uploadFile, {
        contentType: uploadFile.type || file.type,
        purpose: "cover",
      });

      const assetData = await apiMutate<{
        success?: boolean;
        data?: { id?: string };
      }>("/api/admin/covers", {
        method: "POST",
        body: JSON.stringify({
          url: coverUrl,
          key,
          provider: "qiniu",
          source: "upload",
          title: file.name.replace(/\.[^.]+$/, ""),
        }),
      });

      if (!assetData.data) {
        throw new Error("保存到封面图库失败");
      }

      onUploadSuccess({
        coverImage: coverUrl,
        coverAssetId: String(assetData.data.id ?? ""),
      });
    } catch (uploadErrorValue) {
      setCoverUploadError(toErrorMessage(uploadErrorValue, "上传失败"));
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
