"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const router = useRouter();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl shadow-xl focus:outline-none"
        >
          <Dialog.Title className="sr-only">账号登录弹窗</Dialog.Title>
          <Dialog.Description className="sr-only">
            使用邮箱密码或 GitHub 登录账号。
          </Dialog.Description>
          <Dialog.Close
            className="ui-ring absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted)] shadow-[var(--shadow-card)] transition-colors hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            type="button"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">关闭登录弹窗</span>
          </Dialog.Close>
          <LoginForm
            mode="dialog"
            onSuccess={() => {
              onOpenChange(false);
              router.refresh();
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
