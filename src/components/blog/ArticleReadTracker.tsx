"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

import {
  isQualifiedReadingEventInput,
  normalizeReadingScrollDepth,
} from "@/lib/reading-thresholds";

const READ_TIMER_INTERVAL_MS = 1000;

function getStorageKey(postId: string) {
  return `qualified-reading-event:${postId}:${new Date().toISOString().slice(0, 10)}`;
}

function hasRecordedInCurrentTab(postId: string) {
  try {
    return window.sessionStorage.getItem(getStorageKey(postId)) === "1";
  } catch {
    return false;
  }
}

function markRecordedInCurrentTab(postId: string) {
  try {
    window.sessionStorage.setItem(getStorageKey(postId), "1");
  } catch {
    // Storage access can fail in restricted browsing contexts. The server-side
    // unique constraint still prevents duplicate reading records.
  }
}

function getCurrentScrollDepth() {
  const root = document.documentElement;
  const viewportHeight = window.innerHeight || root.clientHeight;
  const scrollableHeight = root.scrollHeight - viewportHeight;

  if (scrollableHeight <= 0) {
    return 0;
  }

  return normalizeReadingScrollDepth((window.scrollY / scrollableHeight) * 100);
}

export function ArticleReadTracker({ postId }: { postId: string }) {
  const { status } = useSession();
  const visibleSecondsRef = useRef(0);
  const maxScrollDepthRef = useRef(0);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!postId || status !== "authenticated") {
      return;
    }

    recordedRef.current = hasRecordedInCurrentTab(postId);
    let isMounted = true;

    const recordIfQualified = () => {
      if (recordedRef.current) {
        return;
      }

      const durationSeconds = visibleSecondsRef.current;
      const scrollDepth = maxScrollDepthRef.current;
      if (!isQualifiedReadingEventInput(durationSeconds, scrollDepth)) {
        return;
      }

      recordedRef.current = true;

      void fetch("/api/reading-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          durationSeconds,
          scrollDepth,
        }),
        keepalive: true,
      })
        .then((response) => {
          if (response.ok && isMounted) {
            markRecordedInCurrentTab(postId);
          }
        })
        .catch(() => undefined);
    };

    const updateScrollDepth = () => {
      maxScrollDepthRef.current = Math.max(maxScrollDepthRef.current, getCurrentScrollDepth());
      recordIfQualified();
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        visibleSecondsRef.current += 1;
        recordIfQualified();
      }
    }, READ_TIMER_INTERVAL_MS);

    updateScrollDepth();
    window.addEventListener("scroll", updateScrollDepth, { passive: true });

    return () => {
      isMounted = false;
      window.clearInterval(timer);
      window.removeEventListener("scroll", updateScrollDepth);
    };
  }, [postId, status]);

  return null;
}
