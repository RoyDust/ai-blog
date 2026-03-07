import type { Metadata } from "next";
import { Geist_Mono, JetBrains_Mono, Manrope, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { MotionProvider } from "@/components/motion";
import { getSiteUrl } from "@/lib/seo";

const notoSansSc = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

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
      <body
        className={`${notoSansSc.variable} ${geistMono.variable} ${manrope.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AuthProvider>
          <ThemeProvider>
            <MotionProvider>
              {children}
            </MotionProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
