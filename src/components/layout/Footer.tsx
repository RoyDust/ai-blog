import Link from "next/link";
import { Heart } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="footer" className="onload-animation mt-auto">
      <div className="mx-auto max-w-[var(--page-width)] py-8">
        <div className="card-base p-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="text-75 flex items-center gap-2 text-sm">
              <span>© {currentYear} My Blog</span>
              <span className="text-50">·</span>
              <span className="flex items-center gap-1">
                Made with <Heart className="h-4 w-4 fill-current text-[var(--danger-foreground)]" /> by My Blog
              </span>
            </div>

            <div className="text-75 flex items-center gap-4 text-sm">
              <Link className="transition hover:text-[var(--primary)]" href="/posts">文章</Link>
              <span className="text-50">·</span>
              <Link className="transition hover:text-[var(--primary)]" href="/categories">分类</Link>
              <span className="text-50">·</span>
              <Link className="transition hover:text-[var(--primary)]" href="/archives">归档</Link>
              <span className="text-50">·</span>
              <a className="transition hover:text-[var(--primary)]" href="/rss.xml">RSS 订阅</a>
              <span className="text-50">·</span>
              <a className="transition hover:text-[var(--primary)]" href="https://github.com/RoyDust" rel="noopener noreferrer" target="_blank">GitHub</a>
            </div>
          </div>

          <div className="mt-4 border-t border-dashed border-[var(--line-color)] pt-4 text-center">
            <p className="text-50 text-xs">
              Powered by <a className="text-[var(--primary)] hover:underline" href="https://nextjs.org" rel="noopener noreferrer" target="_blank">Next.js</a>
              {" · "}
              <a className="text-[var(--primary)] hover:underline" href="https://www.prisma.io" rel="noopener noreferrer" target="_blank">Prisma</a>
              {" · "}
              <a className="text-[var(--primary)] hover:underline" href="https://tailwindcss.com" rel="noopener noreferrer" target="_blank">Tailwind CSS</a>
            </p>
            <p className="text-50 mt-2 text-xs">
              <a className="hover:text-[var(--primary)]" href="https://beian.miit.gov.cn" rel="noopener noreferrer" target="_blank">湘ICP备2022021288号-1</a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
