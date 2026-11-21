import { PostCard, type PostCardPost } from "@/components/blog/PostCard";
import { formatIndex } from "@/lib/editorial-format";

interface GuidePostRowProps {
  post: PostCardPost;
  /** 阅读顺序，从 1 开始 */
  index: number;
  /** 编者导读 */
  note?: string | null;
}

/**
 * 专题导读详情的一行（README 第 11 节）：列表行同系列详情，左列两位等宽序号、日期并入 meta；
 * 编者导读放在标题上方，正文色小字、左侧 2px 竖线，不再是圆角小面板。
 *
 * 行本身仍是全站唯一的列表行 PostCard；有导读时在它上方补一行同栅格的导读，
 * 序号上移到导读行，hover 底色由外层统一铺满（导读 + 列表行）。
 */
export function GuidePostRow({ post, index, note }: GuidePostRowProps) {
  const trimmedNote = note?.trim();

  if (!trimmedNote) {
    return <PostCard dateStyle="index" index={index} post={post} />;
  }

  return (
    <div className="group/guide relative isolate before:pointer-events-none before:absolute before:inset-y-0 before:-inset-x-3 before:-z-10 before:rounded-[var(--radius-ctl)] before:bg-[var(--ed-hover-bg)] before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100 focus-within:before:opacity-100 max-sm:before:-inset-x-2">
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-x-4 pt-4 sm:grid-cols-[4.5rem_minmax(0,1fr)_7.5rem] sm:gap-x-5 sm:pt-5">
        <span aria-hidden="true" className="ed-row__index max-sm:hidden">
          {formatIndex(index)}
        </span>
        <p className="border-l-2 border-[var(--reader-border-strong)] pl-3 text-[0.875rem] leading-[1.6] text-[var(--text-body)]">
          {trimmedNote}
        </p>
      </div>
      <PostCard
        className="pt-2.5 before:hidden sm:pt-3 [&>div:first-child]:invisible"
        dateStyle="index"
        index={index}
        post={post}
      />
    </div>
  );
}
