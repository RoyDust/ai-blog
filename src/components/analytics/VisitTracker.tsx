"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { normalizeAnalyticsPath, shouldTrackVisitPath } from "@/lib/analytics";

const VISITOR_ID_KEY = "blog_visitor_id";

function getVisitorId() {
  const existing = window.localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;

  const id = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(VISITOR_ID_KEY, id);
  return id;
}

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const path = normalizeAnalyticsPath(pathname);
    if (!path || !shouldTrackVisitPath(path)) return;

    try {
      const visitorId = getVisitorId();

      void fetch("/api/analytics/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          referrer: document.referrer || null,
          visitorId,
        }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // Analytics should never block page rendering or navigation.
    }
  }, [pathname]);

  return null;
}
