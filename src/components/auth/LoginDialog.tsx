"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { Session } from "next-auth";
import { useRouter } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[color:color-mix(in_oklab,var(--page-bg)_24%,black_54%)] backdrop-blur-md" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-1.25rem)] max-w-[26rem] -translate-x-1/2 -translate-y-1/2 overflow-y-auto focus:outline-none sm:w-[calc(100%-2rem)]"
        >
          <Dialog.Title className="sr-only">账号登录弹窗</Dialog.Title>
          <Dialog.Description className="sr-only">
            使用邮箱密码或 GitHub 登录账号。
          </Dialog.Description>
          <Dialog.Close
            className="ui-ring absolute right-3.5 top-3.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--btn-plain-bg-hover)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            type="button"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">关闭登录弹窗</span>
          </Dialog.Close>
          <LoginForm
            mode="dialog"
            authError={authError}
            callbackUrl={callbackUrl}
            oauthCallbackUrl={oauthCallbackUrl}
            onAdminSuccess={hasCallbackUrl ? handleAdminSuccess : undefined}
            onSuccess={handleSuccess}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
