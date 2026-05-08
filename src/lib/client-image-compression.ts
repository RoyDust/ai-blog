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

function normalizeType(type: string) {
  return type.trim().toLowerCase();
}

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

function filenameForOutputType(filename: string, type: string) {
  const extension = extensionForImageType(type);
  if (!extension) return filename;

  const baseName = filename.replace(/\.[^.]+$/, "") || "image";
  return `${baseName}.${extension}`;
}

function toUploadFile(blob: Blob, originalFile: File) {
  const type = blob.type || originalFile.type;

  return new File([blob], filenameForOutputType(originalFile.name, type), {
    lastModified: originalFile.lastModified,
    type,
  });
}

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
