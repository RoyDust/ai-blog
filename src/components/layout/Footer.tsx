import Link from "next/link";
import { Archive, BookOpenText, FolderOpen, Rss } from "lucide-react";

const footerLinks = [
  { href: "/posts", label: "文章", icon: BookOpenText },
  { href: "/categories", label: "分类", icon: FolderOpen },
  { href: "/archives", label: "归档", icon: Archive },
  { href: "/rss.xml", label: "RSS 订阅", icon: Rss, external: true },
];

export function Footer() {
  return (
    <footer id="footer" className="onload-animation mt-auto">
      <div className="mx-auto max-w-[var(--page-width)] py-8">
        <div className="reader-panel p-5 md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl space-y-2">
              <p className="ui-kicker text-[var(--accent-warm)]">My Blog</p>
              <p className="text-75 text-sm leading-7">
                夜读模式下整理前端、工程实践和部署笔记，让长期积累有清晰入口。
              </p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap items-center gap-2">
              {footerLinks.map((link) => {
                const Icon = link.icon;

                if (link.external) {
                  return (
                    <a key={link.href} className="reader-chip" href={link.href}>
                      <Icon className="h-3.5 w-3.5" />
                      {link.label}
                    </a>
                  );
                }

                return (
                  <Link key={link.href} className="reader-chip" href={link.href}>
                    <Icon className="h-3.5 w-3.5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
