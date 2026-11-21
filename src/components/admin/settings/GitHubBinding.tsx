"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { apiMutate, toErrorMessage } from "@/lib/client-api";

type GitHubBindingProps = {
  initialLinked: boolean;
};

/**
 * GitHub 账号绑定状态与操作入口。
 *
 * 绑定状态以服务端从 Account 表查询到的 initialLinked 为初始值；解绑成功后仅更新本地 UI。
 * 若用户刷新页面，状态会再次以数据库为准。
 */
export function GitHubBinding({ initialLinked }: GitHubBindingProps) {
  const [linked, setLinked] = useState(initialLinked);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);

  const handleLink = async () => {
    setLinking(true);
    await signIn("github", {
      callbackUrl: "/admin/settings?github=linked",
    });
  };

  const handleUnlink = async (): Promise<boolean> => {
    setUnlinking(true);
    try {
      await apiMutate("/api/account/github/unlink", { method: "POST" });

      setLinked(false);
      toast.success("GitHub 已解除绑定");
      return true;
    } catch (error) {
      toast.error(toErrorMessage(error, "解除绑定失败"));
      return false;
    } finally {
      setUnlinking(false);
    }
  };

  const confirmUnlink = async () => {
    const unlinked = await handleUnlink();
    // 仅成功后关闭弹窗：失败保留弹窗可原地重试
    if (unlinked) {
      setUnlinkConfirmOpen(false);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-[var(--border)] py-3.5"
      data-slot="github-binding"
    >
      <div className="min-w-0">
        <p className="flex items-baseline gap-2.5 text-[0.8125rem] font-bold text-[var(--foreground)]">
          GitHub 账号
          <span className={`text-xs font-bold ${linked ? "text-[var(--success)]" : "text-[var(--text-muted)]"}`}>
            {linked ? "已绑定" : "未绑定"}
          </span>
        </p>
        <p className="mt-1 text-[0.8125rem] leading-6 text-[var(--text-body)]">
          {linked ? "已绑定 GitHub，可使用 GitHub 登录。" : "绑定后可使用 GitHub 一键登录。"}
        </p>
      </div>

      {linked ? (
        <Button type="button" variant="text-danger" onClick={() => setUnlinkConfirmOpen(true)} disabled={unlinking}>
          {unlinking ? "解除中..." : "解除 GitHub 绑定"}
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={handleLink} disabled={linking}>
          {linking ? "跳转中..." : "绑定 GitHub 账号"}
        </Button>
      )}

      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="确认解绑"
        description="确定要解除 GitHub 绑定吗？解绑后将无法使用 GitHub 登录。"
        onConfirm={confirmUnlink}
        onOpenChange={setUnlinkConfirmOpen}
        open={unlinkConfirmOpen}
        submitting={unlinking}
        title="解除 GitHub 绑定"
        tone="danger"
      />
    </div>
  );
}
