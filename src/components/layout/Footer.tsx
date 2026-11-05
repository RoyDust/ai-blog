import Link from "next/link";

const footerLinks = [
  { href: "/posts", label: "文章" },
  { href: "/series", label: "系列" },
  { href: "/categories", label: "分类" },
  { href: "/archives", label: "归档" },
  { href: "/rss.xml", label: "RSS", ariaLabel: "RSS 订阅", external: true },
];

interface FooterProps {
  siteDescription?: string;
  siteName?: string;
}

const footerLinkClass =
  "inline-flex min-h-11 items-center text-[0.875rem] font-bold text-[var(--text-body)] underline decoration-transparent decoration-1 underline-offset-4 transition-colors hover:text-[var(--foreground)] hover:decoration-[var(--accent-sky)] sm:min-h-0";

/**
 * 页脚（简报 15.9 第 7 条）：纸面内最底部，上方 1px 细线；
 * 左边站名与一句描述，右边纯文字链接用 · 分隔。
 */
// Keep these fallbacks aligned with DEFAULT_BLOG_SETTINGS without importing server-only settings code.
export function Footer({
  siteDescription = "夜读模式下整理前端、工程实践和部署笔记，让长期积累有清晰入口。",
  siteName = "My Blog",
}: FooterProps) {
  return (
    <footer id="footer" className="mt-10 border-t border-[var(--border)] pt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="min-w-0 text-[0.875rem] leading-6">
          <span className="font-bold text-[var(--foreground)]">{siteName}</span>
          <span className="ml-3 text-[var(--text-muted)]">{siteDescription}</span>
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-1 gap-y-0">
            {footerLinks.map((link, index) => (
              <li key={link.href} className="inline-flex items-center">
                {index > 0 ? (
                  <span aria-hidden="true" className="px-1.5 text-[var(--text-muted)]">
                    ·
                  </span>
                ) : null}
                {link.external ? (
                  <a aria-label={link.ariaLabel} className={footerLinkClass} href={link.href}>
                    {link.label}
                  </a>
                ) : (
                  <Link className={footerLinkClass} href={link.href}>
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
