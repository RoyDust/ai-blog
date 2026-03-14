import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";
import { getSiteUrl } from "@/lib/seo";
import { alibabaPuHuiTi } from "./fonts";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "My Blog",
    template: "%s | My Blog",
  },
  description: "一个基于 Next.js 构建的现代化博客系统。",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'My Blog',
    description: '一个基于 Next.js 构建的现代化博客系统。',
    url: '/',
    siteName: 'My Blog',
    type: 'website',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary',
    title: 'My Blog',
    description: '一个基于 Next.js 构建的现代化博客系统。',
  },
};

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
