import Link from "next/link";
import { Archive, FolderOpen, Tags } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

interface HomeDiscoveryGridProps {
  categories: Array<{ id: string; name: string; slug: string; _count: { posts: number } }>;
}

export function HomeDiscoveryGrid({ categories }: HomeDiscoveryGridProps) {
  return (
    <section className="ui-section">
      <SectionHeader
        eyebrow="发现"
        title="继续探索"
        description="按分类、标签和归档把阅读从单篇文章扩展成主题路径。"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_repeat(2,minmax(0,0.95fr))]">
        <div className="card-base p-6">
          <h3 className="text-90 mb-4 flex items-center gap-2 text-lg font-bold">
            <FolderOpen className="h-5 w-5 text-[var(--primary)]" />
            热门分类
          </h3>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 8).map((category) => (
              <Link key={category.id} href={`/categories/${category.slug}`} className="ui-chip">
                {category.name} ({category._count.posts})
              </Link>
            ))}
          </div>
        </div>

        <Link href="/tags" className="card-base flex flex-col justify-between p-6 transition hover:bg-[var(--btn-card-bg-hover)]">
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 text-lg font-bold">
              <Tags className="h-5 w-5 text-[var(--primary)]" />
              标签地图
            </h3>
            <p className="text-75 text-sm leading-7">从更细的关键词切入，找到同一语义下的文章集合。</p>
          </div>
          <span className="text-50 text-sm">进入标签页</span>
        </Link>

        <Link href="/archives" className="card-base flex flex-col justify-between p-6 transition hover:bg-[var(--btn-card-bg-hover)]">
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 text-lg font-bold">
              <Archive className="h-5 w-5 text-[var(--primary)]" />
              时间归档
            </h3>
            <p className="text-75 text-sm leading-7">按月份回看内容节奏，适合系统梳理旧文和阶段记录。</p>
          </div>
          <span className="text-50 text-sm">浏览归档</span>
        </Link>
      </div>
    </section>
  );
}
