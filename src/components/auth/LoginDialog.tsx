"use client";

import { X } from "lucide-react";
import type { Session } from "next-auth";
import { useRouter } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPortal,
  DialogPrimitive,
  DialogTitle,
  DialogViewport,
} from "@/components/coss/ui/dialog";
import { getPostLoginRedirect } from "@/lib/login-redirect";

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authError?: string | null;
  callbackUrl?: string;
  oauthCallbackUrl?: string;
};

export function LoginDialog({ open, onOpenChange, authError, callbackUrl, oauthCallbackUrl }: LoginDialogProps) {
  const router = useRouter();
  const hasCallbackUrl = Boolean(callbackUrl);

  const handleSuccess = (session: Session | null) => {
    onOpenChange(false);

    if (callbackUrl) {
      window.location.assign(getPostLoginRedirect(session?.user?.role, callbackUrl));
      return;
    }

    router.refresh();
  };

  const handleAdminSuccess = () => {
    onOpenChange(false);
    window.location.assign(getPostLoginRedirect("ADMIN", callbackUrl ?? "/admin"));
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => onOpenChange(nextOpen)}>
      <DialogPortal>
        <DialogBackdrop className="fixed inset-0 z-50 bg-[color:color-mix(in_oklab,var(--page-bg)_24%,black_54%)] backdrop-blur-md" />
        <DialogViewport className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4">
          <DialogPrimitive.Popup
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-[26rem] overflow-y-auto focus:outline-none"
          >
            <DialogTitle className="sr-only">账号登录弹窗</DialogTitle>
            <DialogDescription className="sr-only">
              使用邮箱密码或 GitHub 登录账号。
            </DialogDescription>
            <DialogClose
              className="ui-ring absolute right-3.5 top-3.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--btn-plain-bg-hover)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              type="button"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">关闭登录弹窗</span>
            </DialogClose>
            <LoginForm
              mode="dialog"
              authError={authError}
              callbackUrl={callbackUrl}
              oauthCallbackUrl={oauthCallbackUrl}
              onAdminSuccess={hasCallbackUrl ? handleAdminSuccess : undefined}
              onSuccess={handleSuccess}
            />
          </DialogPrimitive.Popup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
