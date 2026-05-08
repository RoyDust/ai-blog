"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { LoginDialog } from "@/components/auth/LoginDialog";
import { getSafeLoginCallbackUrl } from "@/lib/login-redirect";

const loginParamNames = ["login", "error", "callbackUrl", "registered"];

export function GlobalLoginDialog() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldOpen = searchParams.get("login") === "1";
  const [open, setOpen] = useState(shouldOpen);

  useEffect(() => {
    setOpen(shouldOpen);
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
