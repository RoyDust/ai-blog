import Link from "next/link";

export interface FooterProps {
  copyright?: string;
}

export function Footer({ copyright = "My Blog" }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-[var(--border)] bg-[var(--surface)]/90">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="mb-3 font-display text-lg font-semibold text-[var(--foreground)]">
              {copyright}
            </h3>
            <p className="text-sm text-[var(--muted)]">
              面向读者、作者与管理员的现代内容平台。
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
              快速入口
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--brand)]"
                >
                  探索
                </Link>
              </li>
              <li>
                <Link
                  href="/posts"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--brand)]"
                >
                  文章
                </Link>
              </li>
              <li>
                <Link
                  href="/write"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--brand)]"
                >
                  创作
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
              社区
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--brand)]"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--brand)]"
                >
                  Twitter
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--border)] pt-6 text-center">
          <p className="text-sm text-[var(--muted)]">
            &copy; {currentYear} {copyright}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
