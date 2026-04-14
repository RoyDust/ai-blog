"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";

const FALLBACK_IMAGE_SRC = "/imgs/Error.png";

export type FallbackImageProps = ImageProps;

export function FallbackImage({ alt, src, onError, ...props }: FallbackImageProps) {
  const [currentSrc, setCurrentSrc] = useState<ImageProps["src"]>(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <Image
      alt={alt}
      {...props}
      src={currentSrc}
      onError={(event) => {
        if (currentSrc !== FALLBACK_IMAGE_SRC) {
          setCurrentSrc(FALLBACK_IMAGE_SRC);
        }

        onError?.(event);
      }}
    />
  );
}
