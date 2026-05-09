import Compressor from "compressorjs";

export type ImageUploadCompressionPurpose = "markdown" | "cover";

type CompressionSkipReason =
  | "empty-file"
  | "unsupported-type"
  | "not-smaller"
  | "compression-failed";

type CompressionProfile = {
  maxDimension: number;
  quality: number;
  minQuality: number;
  targetBytes: number;
};

export type ImageCompressionResult = {
  file: File;
  originalFile: File;
  compressed: boolean;
  originalSize: number;
  outputSize: number;
  skippedReason?: CompressionSkipReason;
};

const compressibleTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const qualityAdjustableTypes = new Set(["image/jpeg", "image/jpg", "image/webp"]);

/**
 * 不同上传场景的压缩策略。
 *
 * 正文图优先控制体积；封面图保留更高尺寸和质量，避免列表页大图发虚。
 */
const compressionProfiles: Record<ImageUploadCompressionPurpose, CompressionProfile> = {
  markdown: {
    maxDimension: 1920,
    quality: 0.82,
    minQuality: 0.68,
    targetBytes: 1_000_000,
  },
  cover: {
    maxDimension: 2400,
    quality: 0.84,
    minQuality: 0.72,
    targetBytes: 1_500_000,
  },
};

/**
 * 统一 MIME 类型大小写，避免浏览器返回大小写差异导致匹配失败。
 */
function normalizeType(type: string) {
  return type.trim().toLowerCase();
}

/**
 * 构造压缩结果对象，并保留原文件体积用于后台提示或测试断言。
 */
function createResult(file: File, originalFile: File, compressed: boolean, skippedReason?: CompressionSkipReason) {
  return {
    file,
    originalFile,
    compressed,
    originalSize: originalFile.size,
    outputSize: file.size,
    skippedReason,
  };
}

/**
 * 根据输出 MIME 类型决定文件扩展名。
 */
function extensionForImageType(type: string) {
  switch (normalizeType(type)) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

/**
 * 当 compressorjs 改变输出格式时，同步修正上传文件名后缀。
 */
function filenameForOutputType(filename: string, type: string) {
  const extension = extensionForImageType(type);
  if (!extension) return filename;

  const baseName = filename.replace(/\.[^.]+$/, "") || "image";
  return `${baseName}.${extension}`;
}

/**
 * 把 compressorjs 返回的 Blob 包装回 File，保留原文件的 lastModified 元数据。
 */
function toUploadFile(blob: Blob, originalFile: File) {
  const type = blob.type || originalFile.type;

  return new File([blob], filenameForOutputType(originalFile.name, type), {
    lastModified: originalFile.lastModified,
    type,
  });
}

/**
 * 运行 compressorjs 的 Promise 包装。
 */
function runCompressor(file: File, profile: CompressionProfile, quality: number) {
  return new Promise<File>((resolve, reject) => {
    new Compressor(file, {
      checkOrientation: true,
      convertSize: profile.targetBytes,
      convertTypes: ["image/png"],
      maxHeight: profile.maxDimension,
      maxWidth: profile.maxDimension,
      mimeType: file.type,
      quality,
      resize: "contain",
      strict: true,
      success: (output) => resolve(toUploadFile(output, file)),
      error: reject,
    });
  });
}

/**
 * 根据上传用途压缩图片。
 *
 * 如果压缩失败、格式不支持或压缩后没有变小，会返回原文件并标记 skippedReason。
 */
export async function compressImageForUpload(
  file: File,
  purpose: ImageUploadCompressionPurpose = "cover",
): Promise<ImageCompressionResult> {
  const fileType = normalizeType(file.type);

  if (file.size <= 0) {
    return createResult(file, file, false, "empty-file");
  }

  if (!compressibleTypes.has(fileType)) {
    return createResult(file, file, false, "unsupported-type");
  }

  const profile = compressionProfiles[purpose];

  try {
    let compressedFile = await runCompressor(file, profile, profile.quality);

    if (
      compressedFile.size > profile.targetBytes &&
      qualityAdjustableTypes.has(fileType) &&
      profile.minQuality < profile.quality
    ) {
      const lowerQualityFile = await runCompressor(file, profile, profile.minQuality);
      if (lowerQualityFile.size < compressedFile.size) {
        compressedFile = lowerQualityFile;
      }
    }

    if (compressedFile.size <= 0 || compressedFile.size >= file.size) {
      return createResult(file, file, false, "not-smaller");
    }

    return createResult(compressedFile, file, true);
  } catch {
    return createResult(file, file, false, "compression-failed");
  }
}
