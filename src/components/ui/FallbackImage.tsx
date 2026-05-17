"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";

const FALLBACK_IMAGE_SRC = "/imgs/Error.png";

export type FallbackImageProps = ImageProps & {
  fallbackSrc?: ImageProps["src"];
};

export function FallbackImage({ alt, src, fallbackSrc, onError, ...props }: FallbackImageProps) {
  const [currentSrc, setCurrentSrc] = useState<ImageProps["src"]>(src);
  const resolvedFallbackSrc = fallbackSrc ?? FALLBACK_IMAGE_SRC;

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <Image
      alt={alt}
      {...props}
      src={currentSrc}
      onError={(event) => {
        if (currentSrc !== resolvedFallbackSrc) {
          setCurrentSrc(resolvedFallbackSrc);
        }

        onError?.(event);
      }}
    />
  );
}
