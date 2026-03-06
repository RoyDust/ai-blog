import Link from "next/link";

export interface HeaderProps {
  siteName?: string;
}

const primaryLinks = [
  { href: "/", label: "鎺㈢储" },
  { href: "/posts", label: "鏂囩珷" },
  { href: "/categories", label: "鍒嗙被" },
  { href: "/tags", label: "鏍囩" },
  { href: "/admin/posts/new", label: "鍒涗綔" },
  { href: "/admin", label: "绠＄悊" },
];

export function Header({ siteName = "My Blog" }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_88%,white_12%)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-4 lg:px-6">
        <Link
          href="/"
          className="font-display text-xl font-extrabold tracking-tight text-[var(--foreground)] transition-colors hover:text-[var(--brand)]"
        >
          {siteName}
        </Link>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            鐧诲綍
          </Link>
          <Link
            href="/register"
            className="ui-btn bg-[var(--brand)] px-4 py-2 text-sm text-white hover:bg-[var(--brand-strong)]"
          >
            娉ㄥ唽
          </Link>
        </div>
      </div>
    </header>
  );
}


