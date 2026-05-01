"use client";

import {
  type ChangeEvent,
  type PointerEvent,
  type SyntheticEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Crop, ImagePlus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

type UploadPurpose = "avatar" | "cover";

type CropState = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

type CropCalculationInput = CropState & {
  frameSize?: number;
  naturalWidth: number;
  naturalHeight: number;
  viewportSize: number;
};

type OffsetBoundsInput = {
  frameSize?: number;
  naturalWidth: number;
  naturalHeight: number;
  viewportSize: number;
  zoom: number;
};

export type ImageCropUploadDialogProps = {
  currentImage?: string;
  fallbackText?: string;
  outputFileName?: string;
  outputSize?: number;
  purpose?: UploadPurpose;
  triggerLabel?: string;
  onUploaded: (url: string) => void;
  className?: string;
};

const defaultCrop: CropState = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};
const viewportSize = 288;
const cropFrameInset = 24;
const cropFrameSize = viewportSize - cropFrameInset * 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function calculateSquareCrop({
  frameSize,
  naturalWidth,
  naturalHeight,
  viewportSize,
  zoom,
  offsetX,
  offsetY,
}: CropCalculationInput) {
  const activeFrameSize = frameSize ?? viewportSize;
  const baseScale = Math.max(viewportSize / naturalWidth, viewportSize / naturalHeight);
  const finalScale = baseScale * zoom;
  const cropSize = Math.min(naturalWidth, naturalHeight, activeFrameSize / finalScale);
  const centerX = naturalWidth / 2 - offsetX / finalScale;
  const centerY = naturalHeight / 2 - offsetY / finalScale;

  return {
    sx: clamp(centerX - cropSize / 2, 0, Math.max(0, naturalWidth - cropSize)),
    sy: clamp(centerY - cropSize / 2, 0, Math.max(0, naturalHeight - cropSize)),
    size: cropSize,
  };
}

export function calculateOffsetBounds({ frameSize, naturalWidth, naturalHeight, viewportSize, zoom }: OffsetBoundsInput) {
  const activeFrameSize = frameSize ?? viewportSize;
  const baseScale = Math.max(viewportSize / naturalWidth, viewportSize / naturalHeight);
  const renderedWidth = naturalWidth * baseScale * zoom;
  const renderedHeight = naturalHeight * baseScale * zoom;

  return {
    maxX: Math.max(0, (renderedWidth - activeFrameSize) / 2),
    maxY: Math.max(0, (renderedHeight - activeFrameSize) / 2),
  };
}

function clampCropToImage(crop: CropState, imageSize: { width: number; height: number } | null) {
  if (!imageSize) return crop;

  const bounds = calculateOffsetBounds({
    frameSize: cropFrameSize,
    naturalWidth: imageSize.width,
    naturalHeight: imageSize.height,
    viewportSize,
    zoom: crop.zoom,
  });

  return {
    ...crop,
    offsetX: clamp(crop.offsetX, -bounds.maxX, bounds.maxX),
    offsetY: clamp(crop.offsetY, -bounds.maxY, bounds.maxY),
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = src;
  });
}

async function createCroppedBlob(sourceUrl: string, crop: CropState, outputSize: number) {
  const image = await loadImage(sourceUrl);
  const { sx, sy, size } = calculateSquareCrop({
    frameSize: cropFrameSize,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    viewportSize,
    ...crop,
  });
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("浏览器不支持图片处理");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sx, sy, size, size, 0, 0, outputSize, outputSize);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("图片裁切失败"));
      },
      "image/webp",
      0.92,
    );
  });
}

async function uploadBlob(blob: Blob, filename: string, purpose: UploadPurpose) {
  const tokenResponse = await fetch("/api/admin/uploads/qiniu-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType: blob.type, purpose }),
  });
  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.success) {
    throw new Error(tokenData.error || "获取上传凭证失败");
  }

  const payload = new FormData();
  payload.append("file", blob, filename);
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
  return `${normalizedDomain}/${tokenData.data.key}`;
}

export function ImageCropUploadDialog({
  currentImage,
  fallbackText = "A",
  outputFileName,
  outputSize = 512,
  purpose = "avatar",
  triggerLabel = "编辑头像",
  onUploaded,
  className,
}: ImageCropUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number; crop: CropState } | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<CropState>(defaultCrop);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const offsetBounds = useMemo(() => {
    if (!imageSize) return { maxX: 0, maxY: 0 };

    return calculateOffsetBounds({
      frameSize: cropFrameSize,
      naturalWidth: imageSize.width,
      naturalHeight: imageSize.height,
      viewportSize,
      zoom: crop.zoom,
    });
  }, [crop.zoom, imageSize]);

  const previewStyle = useMemo(() => {
    if (!imageSize) return undefined;

    const baseScale = Math.max(viewportSize / imageSize.width, viewportSize / imageSize.height);
    return {
      height: imageSize.height * baseScale,
      transform: `translate(-50%, -50%) translate(${crop.offsetX}px, ${crop.offsetY}px) scale(${crop.zoom})`,
      transformOrigin: "center",
      width: imageSize.width * baseScale,
    };
  }, [crop.offsetX, crop.offsetY, crop.zoom, imageSize]);

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [sourceUrl]);

  const resetEditor = () => {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
    setSourceUrl("");
    setFileName("");
    setImageSize(null);
    setCrop(defaultCrop);
    setDragging(false);
    dragStartRef.current = null;
    setError("");
    setUploading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }

    setFileName(file.name);
    setCrop(defaultCrop);
    setError("");
    setImageSize(null);
    setSourceUrl(URL.createObjectURL(file));
  };

  const handleImageLoaded = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
  };

  const updateCrop = (nextCrop: CropState) => {
    setCrop(clampCropToImage(nextCrop, imageSize));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!imageSize) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      crop,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;

    updateCrop({
      ...dragStart.crop,
      offsetX: dragStart.crop.offsetX + event.clientX - dragStart.x,
      offsetY: dragStart.crop.offsetY + event.clientY - dragStart.y,
    });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!imageSize) return;

    event.preventDefault();
    const nextOffsetX = crop.offsetX - (event.shiftKey ? event.deltaY : event.deltaX);
    const nextOffsetY = event.shiftKey ? crop.offsetY : crop.offsetY - event.deltaY;

    updateCrop({
      ...crop,
      offsetX: nextOffsetX,
      offsetY: nextOffsetY,
    });
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current?.pointerId === event.pointerId) {
      dragStartRef.current = null;
      setDragging(false);
    }
  };

  const handleUpload = async () => {
    if (!sourceUrl) return;

    setUploading(true);
    setError("");

    try {
      const blob = await createCroppedBlob(sourceUrl, crop, outputSize);
      const safeName = (outputFileName ?? fileName.replace(/\.[^.]+$/, "")) || "avatar";
      const finalName = safeName.endsWith(".webp") ? safeName : `${safeName}.webp`;
      const url = await uploadBlob(blob, finalName, purpose);
      onUploaded(url);
      resetEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "头像上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input ref={inputRef} accept="image/*" className="hidden" type="file" onChange={handleFileChange} />
      <button
        aria-label={triggerLabel}
        className={cn(
          "group relative inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--surface)] text-xl font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] transition hover:ring-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          className,
        )}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {currentImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="当前头像" className="h-full w-full object-cover" src={currentImage} />
        ) : (
          fallbackText.slice(0, 1).toUpperCase()
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
          <ImagePlus className="h-5 w-5" aria-hidden="true" />
        </span>
      </button>

      <Dialog open={Boolean(sourceUrl)} onOpenChange={(open) => !open && resetEditor()}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>裁切头像</DialogTitle>
            <DialogDescription>拖动图片或滚动触控板调整位置，也可以用滑块精调，生成 1:1 头像后上传到图床。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
              <div
                aria-label="拖动图片调整头像位置"
                className={cn(
                  "relative h-72 w-72 touch-none overflow-hidden rounded-2xl bg-[var(--surface)]",
                  imageSize ? "cursor-grab" : "cursor-default",
                  dragging ? "cursor-grabbing" : null,
                )}
                onPointerCancel={stopDragging}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDragging}
                onWheel={handleWheel}
                role="img"
              >
                {sourceUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="待裁切图片"
                    className="absolute left-1/2 top-1/2 max-w-none select-none"
                    draggable={false}
                    onLoad={handleImageLoaded}
                    src={sourceUrl}
                    style={previewStyle}
                  />
                ) : null}
                <div className="pointer-events-none absolute inset-6 rounded-full ring-2 ring-white shadow-[0_0_0_999px_rgba(15,23,42,0.38)]" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="avatar-crop-zoom">
                  缩放
                </label>
                <input
                  id="avatar-crop-zoom"
                  className="w-full accent-[var(--brand)]"
                  max="3"
                  min="1"
                  onChange={(event) => updateCrop({ ...crop, zoom: Number(event.target.value) })}
                  step="0.05"
                  type="range"
                  value={crop.zoom}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="avatar-crop-offset-x">
                  横向位置
                </label>
                <input
                  id="avatar-crop-offset-x"
                  className="w-full accent-[var(--brand)]"
                  disabled={!offsetBounds.maxX}
                  max={offsetBounds.maxX}
                  min={-offsetBounds.maxX}
                  onChange={(event) => updateCrop({ ...crop, offsetX: Number(event.target.value) })}
                  type="range"
                  value={crop.offsetX}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="avatar-crop-offset-y">
                  纵向位置
                </label>
                <input
                  id="avatar-crop-offset-y"
                  className="w-full accent-[var(--brand)]"
                  disabled={!offsetBounds.maxY}
                  max={offsetBounds.maxY}
                  min={-offsetBounds.maxY}
                  onChange={(event) => updateCrop({ ...crop, offsetY: Number(event.target.value) })}
                  type="range"
                  value={crop.offsetY}
                />
              </div>
              <Button className="w-full" onClick={() => setCrop(defaultCrop)} type="button" variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                重置裁切
              </Button>
            </div>
          </div>

          {error ? <p className="mx-6 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          <DialogFooter>
            <Button disabled={uploading} onClick={resetEditor} type="button" variant="outline">
              取消
            </Button>
            <Button disabled={uploading || !imageSize} onClick={() => void handleUpload()} type="button">
              {uploading ? (
                "上传中..."
              ) : (
                <>
                  <Crop className="mr-2 h-4 w-4" />
                  裁切并上传
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
