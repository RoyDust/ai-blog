import type { Metadata } from "next";

import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "账号入口",
  description: "登录或注册账号以进入个人与后台功能。",
  path: "/login",
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-theme bg-background flex min-h-screen items-center justify-center px-4 py-12 text-foreground">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
