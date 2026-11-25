"use client";

import { Maximize2, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPortal,
  DialogPrimitive,
  DialogTitle,
  DialogTrigger,
  DialogViewport,
} from "@/components/coss/ui/dialog";
import { FallbackImage } from "@/components/ui";
import { cn } from "@/lib/cn";

interface ArticleImageZoomProps {
  src: string;
  alt: string;
  className?: string;
}

export function ArticleImageZoom({ src, alt, className }: ArticleImageZoomProps) {
  const [open, setOpen] = useState(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
      <DialogTrigger
        nativeButton={false}
        render={
          <span
            role="button"
            tabIndex={0}
            aria-label={alt ? `放大查看图片：${alt}` : "放大查看图片"}
            onKeyDown={handleKeyDown}
            className={cn(className, "group/zoom relative cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]")}
          />
        }
      >
        <FallbackImage
          alt={alt}
          className="theme-media-image h-auto w-full transition-transform duration-300 group-hover/zoom:scale-[1.01]"
          height={900}
          src={src}
          unoptimized
          width={1600}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 bottom-3 inline-flex h-7 items-center gap-1 rounded-lg bg-black/55 px-2 text-[11px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/zoom:opacity-100"
        >
          <Maximize2 className="h-3 w-3" />
          放大
        </span>
      </DialogTrigger>

      <DialogPortal>
        <DialogBackdrop className="fixed inset-0 z-50 bg-black/82 backdrop-blur-md" />
        <DialogViewport className="fixed inset-0 z-50 flex items-center justify-center p-0">
          <DialogPrimitive.Popup
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-8 focus:outline-none"
            onClick={() => setOpen(false)}
          >
            <DialogTitle className="sr-only">{alt || "文章图片预览"}</DialogTitle>
            <DialogDescription className="sr-only">点击空白处或按 Esc 关闭大图预览。</DialogDescription>

            <DialogClose
              aria-label="关闭图片预览"
              onClick={(event) => event.stopPropagation()}
              className="fixed top-4 right-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogClose>

            <div
              className="flex max-h-[88vh] max-w-[94vw] flex-col items-center gap-2.5"
              onClick={(event) => event.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={alt}
                src={src}
                className="max-h-[82vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
              />
              {alt ? (
                <p className="max-w-2xl text-center text-xs leading-5 text-white/80">{alt}</p>
              ) : null}
            </div>
          </DialogPrimitive.Popup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
