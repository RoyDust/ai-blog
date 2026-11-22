"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { normalizeAnalyticsPath, shouldTrackVisitPath } from "@/lib/analytics";

const VISITOR_ID_KEY = "blog_visitor_id";

export function sanitizeVisitReferrer(rawReferrer: unknown): string | null {
  if (typeof rawReferrer !== "string") {
    return null;
  }

  const trimmed = rawReferrer.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    try {
      return new URL(trimmed, "http://localhost").pathname;
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const rawBeforeQueryOrHash = trimmed.split(/[?#]/, 1)[0] ?? "";
    const pathname =
      parsed.pathname === "/" && !rawBeforeQueryOrHash.endsWith("/") ? "" : parsed.pathname;

    return `${parsed.origin}${pathname}`;
  } catch {
    return null;
  }
}

function getVisitorId() {
  const id = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    window.localStorage.setItem(VISITOR_ID_KEY, id);
  } catch {
    // Ignore storage errors when browser storage is disabled.
  }

  return id;
}

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const path = normalizeAnalyticsPath(pathname);
    if (!path || !shouldTrackVisitPath(path)) return;

    try {
      const visitorId = getVisitorId();
      const referrer = sanitizeVisitReferrer(document.referrer);

      void fetch("/api/analytics/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          referrer,
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
