import Link from "next/link";

export function Footer() {
  return (
    <footer id="footer" className="onload-animation mt-auto">
      <div className="mx-auto max-w-[var(--page-width)] py-8">
        <div className="card-base p-6 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="ui-kicker">My Blog</p>
              <p className="text-75 text-sm leading-7">围绕技术主题、实践记录和长期积累组织阅读入口。</p>
            </div>
            <div className="text-75 flex flex-wrap items-center gap-4 text-sm">
              <Link href="/posts">文章</Link>
              <Link href="/categories">分类</Link>
              <Link href="/archives">归档</Link>
              <a href="/rss.xml">RSS 订阅</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
