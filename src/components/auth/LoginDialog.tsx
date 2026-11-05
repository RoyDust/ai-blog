"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Session } from "next-auth";
import { useRouter } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { editorialEase } from "@/components/editorial";
import { getPostLoginRedirect } from "@/lib/login-redirect";

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authError?: string | null;
  callbackUrl?: string;
  oauthCallbackUrl?: string;
};

/**
 * 读者登录弹层（原型 12 第 3 张）：30rem 居中纸面（card-bg + 1px --reader-border-strong + 6px 圆角），
 * 66% 黑遮罩（--ed-overlay），没有投影和 backdrop-blur。
 * 打开：遮罩淡入 + 纸面自下 12px 浮起；关闭反向。prefers-reduced-motion 时只做淡入淡出。
 */
export function LoginDialog({ open, onOpenChange, authError, callbackUrl, oauthCallbackUrl }: LoginDialogProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
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

  const paperOffset = reduceMotion ? 0 : 12;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal key="login-dialog" forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="ed-overlay fixed inset-0 z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.22, ease: "easeOut" } }}
                exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="ed-popover fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[30rem] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain focus:outline-none sm:w-[calc(100%-2rem)]"
                initial={{ opacity: 0, y: paperOffset }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.34, ease: editorialEase } }}
                exit={{ opacity: 0, y: paperOffset / 2, transition: { duration: 0.18, ease: "easeIn" } }}
              >
                <Dialog.Title className="sr-only">账号登录弹窗</Dialog.Title>
                <Dialog.Description className="sr-only">使用邮箱密码或 GitHub 登录账号。</Dialog.Description>
                <LoginForm
                  mode="dialog"
                  authError={authError}
                  callbackUrl={callbackUrl}
                  oauthCallbackUrl={oauthCallbackUrl}
                  onAdminSuccess={hasCallbackUrl ? handleAdminSuccess : undefined}
                  onSuccess={handleSuccess}
                />
                {/* 关闭按钮放在表单之后：打开时焦点先落到邮箱输入框，视觉上仍在右上角 */}
                <Dialog.Close className="ed-icon-btn absolute right-3 top-3 z-10 sm:right-4 sm:top-4" type="button">
                  <X aria-hidden="true" className="h-[18px] w-[18px]" />
                  <span className="sr-only">关闭登录弹窗</span>
                </Dialog.Close>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
