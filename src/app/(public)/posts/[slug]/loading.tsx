import { SkeletonBar } from "@/components/editorial";

/** 正文段落骨架：每行占一个真实行高（17px × 1.85 ≈ 31.45px），细条居中 */
function ProseLines({ widths }: { widths: string[] }) {
  return (
    <div>
      {widths.map((width, index) => (
        <div className="flex h-[1.965rem] items-center" key={index}>
          <SkeletonBar className={`h-3.5 ${width}`} />
        </div>
      ))}
    </div>
  );
}

/**
 * 文章详情整页骨架（09 号原型状态画板 B）：Hero 高度、连载条、正文行高、目录 4 行与真实页面一致，避免切换时跳动。
 * 封面位用同尺寸 6% 块，其上的文字条用 8%，以区分层级；栏间竖线与细线照画。
 */
export default function PostLoading() {
  return (
    <div aria-busy="true" className="article-detail-page relative overflow-x-clip pb-4">
      <span className="ed-visually-hidden" role="status">
        正在加载文章
      </span>
      <div aria-hidden="true" className="article-layout">
        <div className="article-column">
          <div className="flex min-h-5 items-center">
            <SkeletonBar className="h-3 w-[46%]" />
          </div>
          <div className="ed-skel mt-3 flex min-h-[clamp(16rem,30vw,22rem)] flex-col justify-end gap-3 rounded-[var(--radius-ctl)] p-7">
            <SkeletonBar strong className="h-3 w-16" />
            <SkeletonBar strong className="h-8 w-[78%]" />
            <SkeletonBar strong className="h-3.5 w-[68%]" />
            <SkeletonBar strong className="h-3 w-[40%]" />
          </div>

          <div className="mt-5 border-y border-[var(--border)]">
            <div className="flex min-h-11 items-center pt-1.5">
              <SkeletonBar className="h-3.5 w-[58%]" />
            </div>
            <div className="h-0.5 bg-[var(--border)]" />
            <div className="flex min-h-11 items-center">
              <SkeletonBar className="h-3 w-[22%]" />
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <ProseLines widths={["w-full", "w-full", "w-full", "w-[62%]"]} />
            <ProseLines widths={["w-full", "w-[48%]"]} />
            <div className="pt-5">
              <SkeletonBar strong className="h-6 w-[52%]" />
            </div>
            <ProseLines widths={["w-full", "w-full", "w-[70%]"]} />
          </div>
        </div>

        <span className="article-layout__rule" />

        <div className="hidden self-start pt-2 xl:block">
          <SkeletonBar className="mb-3 ml-3 h-4 w-10" />
          <div className="space-y-3.5 border-l border-[var(--border)] py-1.5">
            <SkeletonBar className="ml-3 h-3 w-[80%]" />
            <SkeletonBar className="ml-5 h-3 w-[66%]" />
            <SkeletonBar className="ml-5 h-3 w-[70%]" />
            <SkeletonBar className="ml-3 h-3 w-[60%]" />
          </div>
        </div>
      </div>
    </div>
  );
}
