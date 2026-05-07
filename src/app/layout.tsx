import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";
import { getSiteUrl } from "@/lib/seo";
import { alibabaPuHuiTi } from "./fonts";

/**
 * 应用根布局。
 *
 * 职责：
 * - 定义全站共享 metadata
 * - 注入全局样式与字体变量
 * - 把认证、主题、动效、消息提示等 provider 集中挂到页面树根部
 *
 * 阅读建议：
 * - 页面级 SEO 细节看各 route 的 metadata 生成逻辑
 * - 全局上下文装配看 AppProviders
 */
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "My Blog",
    template: "%s | My Blog",
  },
  description: "一个基于 Next.js 构建的现代化博客系统。",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "My Blog",
    description: "一个基于 Next.js 构建的现代化博客系统。",
    url: "/",
    siteName: "My Blog",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary",
    title: "My Blog",
    description: "一个基于 Next.js 构建的现代化博客系统。",
  },
};

/**
 * Next.js App Router 的根布局组件。
 * 所有页面最终都会包裹在这里，因此只放真正需要全局共享的壳层能力。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${alibabaPuHuiTi.variable} antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
