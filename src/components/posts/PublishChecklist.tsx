interface PublishChecklistProps {
  title: string;
  slug: string;
  content: string;
  coverImage: string;
}

export function PublishChecklist({ title, slug, content, coverImage }: PublishChecklistProps) {
  const checks = [
    { label: "标题已填写", done: title.trim().length >= 8 },
    { label: "Slug 已生成", done: slug.trim().length >= 3 },
    { label: "正文不少于 200 字", done: content.trim().length >= 200 },
    { label: "封面图已设置", done: coverImage.trim().length > 0 },
  ];
  const completed = checks.filter((item) => item.done).length;

  return (
    <section className="ui-surface rounded-2xl p-5">
      <h3 className="mb-3 font-display text-lg font-semibold text-[var(--foreground)]">发布设置</h3>
      <p className="mb-4 text-sm text-[var(--muted)]">完成 {completed}/4 项后更适合直接发布。</p>
      <ul className="space-y-2">
        {checks.map((item) => (
          <li className="flex items-center gap-2 text-sm" key={item.label}>
            <span className={item.done ? "text-[var(--success-foreground)]" : "text-[var(--muted)]"}>{item.done ? "●" : "○"}</span>
            <span className={item.done ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
