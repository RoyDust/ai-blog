import { cn } from "@/lib/cn";

/**
 * 站点字标方块：foreground 底、4px 圆角、衬线单字（简报 15.3 / 17.2）。
 * 字取站名第一个字符；尺寸由调用方用 size 控制（导航 28px、报头 44px、手机报头 36px）。
 */
export function BrandMark({ siteName, size = 28, className }: { siteName: string; size?: number; className?: string }) {
  const glyph = Array.from(siteName.trim())[0] ?? "·";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[var(--radius-ctl)] bg-[var(--foreground)] text-[var(--card-bg)]",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.56) }}
    >
      <span className="ed-serif leading-none">{glyph}</span>
    </span>
  );
}
