"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { LoginDialog } from "@/components/auth/LoginDialog";
import { getSafeLoginCallbackUrl } from "@/lib/login-redirect";

const loginParamNames = ["login", "error", "callbackUrl", "registered"];

function scheduleAfterPageHydration(callback: () => void) {
  let firstFrameId: number | null = null;
  let secondFrameId: number | null = null;

  const requestFrame = (handler: FrameRequestCallback) => {
    if (typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(handler);
    }

    return window.setTimeout(() => handler(window.performance.now()), 16);
  };

  const cancelFrame = (frameId: number) => {
    if (typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(frameId);
      return;
    }

    window.clearTimeout(frameId);
  };

  const scheduleFrames = () => {
    firstFrameId = requestFrame(() => {
      secondFrameId = requestFrame(() => {
        callback();
      });
    });
  };

  if (document.readyState === "complete") {
    scheduleFrames();
  } else {
    window.addEventListener("load", scheduleFrames, { once: true });
  }

  return () => {
    window.removeEventListener("load", scheduleFrames);
    if (firstFrameId !== null) cancelFrame(firstFrameId);
    if (secondFrameId !== null) cancelFrame(secondFrameId);
  };
}

export function GlobalLoginDialog() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldOpen = searchParams.get("login") === "1";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldOpen) {
      return scheduleAfterPageHydration(() => {
        setOpen(true);
      });
    }

    const timeoutId = window.setTimeout(() => {
      setOpen(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [shouldOpen]);

  const authError = searchParams.get("error");
  const callbackUrl = useMemo(() => {
    const value = searchParams.get("callbackUrl");
    return value ? getSafeLoginCallbackUrl(value, "/") : undefined;
  }, [searchParams]);

  const clearLoginParams = () => {
    const nextParams = new URLSearchParams(searchParams.toString());
    loginParamNames.forEach((name) => nextParams.delete(name));

    const nextUrl = nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen && shouldOpen) {
      clearLoginParams();
    }
  };

  return (
    <LoginDialog
      open={open}
      onOpenChange={handleOpenChange}
      authError={authError}
      callbackUrl={callbackUrl}
      oauthCallbackUrl="/auth/redirect"
    />
  );
}
