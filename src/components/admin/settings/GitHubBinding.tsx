"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/admin/ui";

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

  const handleLink = async () => {
    setLinking(true);
    await signIn("github", {
      callbackUrl: "/admin/settings?github=linked",
    });
  };

  const handleUnlink = async () => {
    if (!window.confirm("确定要解除 GitHub 绑定吗？")) return;

    setUnlinking(true);
    try {
      const response = await fetch("/api/account/github/unlink", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        toast.error(data.error || "解除绑定失败");
        return;
      }

      setLinked(false);
      toast.success("GitHub 已解除绑定");
    } catch {
      toast.error("解除绑定失败，请稍后重试");
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-[var(--foreground)]">GitHub 账号</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {linked ? "已绑定 GitHub，可使用 GitHub 登录。" : "绑定后可使用 GitHub 一键登录。"}
          </p>
        </div>
        <svg className="h-6 w-6 shrink-0 text-[var(--foreground)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
      </div>

      {linked ? (
        <Button type="button" variant="outline" onClick={handleUnlink} disabled={unlinking}>
          {unlinking ? "解除中..." : "解除 GitHub 绑定"}
        </Button>
      ) : (
        <Button type="button" onClick={handleLink} disabled={linking}>
          {linking ? "跳转中..." : "绑定 GitHub 账号"}
        </Button>
      )}
    </div>
  );
}
