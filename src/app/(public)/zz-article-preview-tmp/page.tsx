// TEMPORARY visual check page — delete after use.
import { renderArticleView } from "../posts/[slug]/page";
import { getBlogSettings } from "@/lib/blog-settings";
import PostLoading from "../posts/[slug]/loading";

export const dynamic = "force-dynamic";

const content = `性能优化最常见的误区，是在没有数据的情况下凭直觉动手：压缩一遍图片、加几个懒加载、换个更快的 CDN，然后发现首屏还是慢。问题不在于这些手段无效，而在于它们未必打在真正的瓶颈上。

这篇记录我在博客改版时的一次排查过程：先测量，再拆解，最后只改最贵的那一项。

## 瓶颈为什么总在意料之外

我们对页面的直觉，往往来自开发机上的体验：本地网络快、缓存是热的、设备性能好。真实读者的环境完全相反，于是一个在本地几乎察觉不到的同步脚本，到了中端手机上就能把首屏推迟一秒以上。

> 先测量，再优化。没有数据支撑的优化，大多只是把慢换到了别的地方。

### 先录一次真实的加载

打开 Performance 面板，把网络节流设为「快速 4G」、CPU 降速 4 倍，再录一次冷启动。如果想把关键指标留存下来，可以直接在页面里读取 \`performance\`：

\`\`\`ts
// 1. 首字节时间
const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
const ttfb = nav.responseStart - nav.requestStart;

// 2. 最大内容绘制
const lcp = await new Promise<number>((resolve) => {
  new PerformanceObserver((list) => {
    const last = list.getEntries().at(-1);
    if (last) resolve(last.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });
});

console.table({ ttfb, lcp });
\`\`\`

### 把指标拆到具体资源

首字节和最大内容绘制之间的那段时间，才是前端真正能掌控的部分。详见 [关键渲染路径](https://web.dev) 的说明。

- 阻塞渲染的样式
- 同步脚本
- 首屏大图

## 从最贵的一项开始

这次排查的结论有点出乎意料：拖慢首屏的不是图片，而是一个在头部同步加载的统计脚本。

![瀑布图](/images/fuwari-night-city-bg.svg)
*同一页面优化前后的瀑布图对比*

| 指标 | 优化前 | 优化后 |
| --- | --- | --- |
| LCP | 3.4s | 1.6s |

### 字体：中文站点最容易忽略的大头

一套完整的中文字体动辄数兆字节。

## 下一步

下一篇会讲怎么把这些指标接进日常监控。
`;

export default async function Page({ searchParams }: { searchParams: Promise<{ cover?: string; empty?: string; loading?: string }> }) {
  const params = await searchParams;
  if (params.loading === "1") return <PostLoading />;
  const settings = await getBlogSettings();
  const seriesPosts = Array.from({ length: 11 }, (_, index) => ({
    title: index === 5 ? "页面性能优化：先找到真正的瓶颈" : `系列文章第 ${index + 1} 篇的标题`,
    slug: index === 5 ? "perf" : `s-${index + 1}`,
    seriesOrder: index + 1,
  }));
  const post = {
    id: "p1",
    title: "页面性能优化：先找到真正的瓶颈",
    slug: "perf",
    content,
    excerpt: "凭直觉动手是性能优化最常见的误区。先用 Performance 面板录一次真实加载，再决定从哪里下刀。",
    seoDescription: null,
    coverImage: params.cover === "0" ? null : "/images/fuwari-night-city-bg.svg",
    createdAt: new Date("2026-03-02T02:00:00Z"),
    updatedAt: new Date("2026-03-02T02:00:00Z"),
    publishedAt: new Date("2026-03-02T02:00:00Z"),
    published: true,
    viewCount: 1204,
    readingTimeMinutes: 9,
    author: { id: "u1", name: "依尘", image: null },
    category: { name: "性能优化", slug: "perf" },
    series: { title: "未整理与测试内容", slug: "misc", deletedAt: null, posts: seriesPosts },
    tags: [{ name: "性能优化", slug: "a" }, { name: "可观测性", slug: "b" }, { name: "前端架构", slug: "c" }],
    _count: { comments: 2, likes: 128 },
  };
  const comments = params.empty === "1" ? [] : [
    {
      id: "c1", content: "Performance 面板录制那段很实用。之前一直只盯 Lighthouse 分数，没想到瀑布图里能看出这么多东西。",
      authorLabel: "林间", createdAt: new Date("2026-03-03T02:00:00Z"), author: null,
      replies: [{ id: "r1", content: "Lighthouse 适合做回归基线，定位问题还是得看真实录制。", authorLabel: null, createdAt: new Date("2026-03-03T05:00:00Z"), author: { id: "u1", name: "依尘", image: null } }],
    },
    { id: "c2", content: "字体那节想追问一下：font-display: swap 和预加载一起用时，有没有遇到过字体闪烁的问题？", authorLabel: "阿哲", createdAt: new Date("2026-03-05T02:00:00Z"), author: null, replies: [] },
  ];
  const related = [
    { id: "a", title: "前端可观测性：从埋点到告警", slug: "s-5", excerpt: null, coverImage: "/images/fuwari-night-city-bg.svg", createdAt: new Date("2026-02-20"), publishedAt: new Date("2026-02-20"), viewCount: 1, category: { name: "前端开发", slug: "fe" }, tags: [], _count: { likes: 1 } },
    { id: "b", title: "图片懒加载的三种写法对比", slug: "lazy", excerpt: null, coverImage: null, createdAt: new Date("2025-12-18"), publishedAt: new Date("2025-12-18"), viewCount: 1, category: { name: "前端开发", slug: "fe" }, tags: [], _count: { likes: 1 } },
    { id: "c", title: "把 CI/CD 流水线从 20 分钟压到 6 分钟", slug: "s-7", excerpt: null, coverImage: "/images/fuwari-night-city-bg.svg", createdAt: new Date("2026-02-27"), publishedAt: new Date("2026-02-27"), viewCount: 1, category: { name: "工程实践", slug: "eng" }, tags: [], _count: { likes: 1 } },
  ];

  return renderArticleView({
    post: post as never,
    isDraftPreview: false,
    relatedPosts: related as never,
    commentsPromise: Promise.resolve(comments) as never,
    settings: { ...settings, newsletter: { ...settings.newsletter, enabled: true } },
  });
}
