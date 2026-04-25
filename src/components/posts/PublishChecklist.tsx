interface PublishChecklistProps {
  title: string;
  slug: string;
  content: string;
  coverImage: string;
  variant?: "panel" | "inline" | "bar";
}

export function PublishChecklist({ title, slug, content, coverImage, variant = "panel" }: PublishChecklistProps) {
  const checks = [
    { label: "标题已填写", done: title.trim().length >= 8 },
    { label: "Slug 已生成", done: slug.trim().length >= 3 },
    { label: "正文不少于 200 字", done: content.trim().length >= 200 },
    { label: "封面图已设置", done: coverImage.trim().length > 0 },
  ];
  const completed = checks.filter((item) => item.done).length;
  const summary = `完成 ${completed}/4 项后更适合直接发布。`;

  const contentNode = (
    <>
      <p className="mb-4 text-sm text-[var(--muted)]">{summary}</p>
      <ul className="space-y-2">
        {checks.map((item) => (
          <li className="flex items-center gap-2 text-sm" key={item.label}>
            <span className={item.done ? "text-[var(--success-foreground)]" : "text-[var(--muted)]"}>{item.done ? "●" : "○"}</span>
            <span className={item.done ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </>
  );

  if (variant === "bar") {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <p className="shrink-0 text-sm text-[var(--muted)]">{summary}</p>
        <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {checks.map((item) => (
            <li
              className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm"
              key={item.label}
            >
              <span className={item.done ? "text-[var(--success-foreground)]" : "text-[var(--muted)]"}>{item.done ? "●" : "○"}</span>
              <span className={item.done ? "truncate text-[var(--foreground)]" : "truncate text-[var(--muted)]"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (variant === "inline") return contentNode;

  return (
    <section className="ui-surface rounded-2xl p-5">
      <h3 className="mb-3 font-display text-lg font-semibold text-[var(--foreground)]">发布设置</h3>
      {contentNode}
    </section>
  );
}
