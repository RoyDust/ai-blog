import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "default" | "reader" | "compact";
}

const headerVariants = {
  default: {
    root: "flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
    eyebrow: "ui-kicker",
    title: "text-90 font-display text-2xl font-bold md:text-3xl",
    description: "text-75 max-w-[44rem] text-sm leading-7",
  },
  reader: {
    root: "flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
    eyebrow: "ui-kicker text-[var(--accent-warm)]",
    title: "font-display text-2xl font-bold tracking-normal text-[var(--foreground)] md:text-3xl",
    description: "max-w-[42rem] text-sm leading-7 text-[var(--text-body)]",
  },
  compact: {
    root: "flex flex-col gap-2",
    eyebrow: "ui-kicker text-[var(--accent-warm)]",
    title: "font-display text-xl font-bold tracking-normal text-[var(--foreground)]",
    description: "max-w-[34rem] text-sm leading-7 text-[var(--text-body)]",
  },
};

export function SectionHeader({ eyebrow, title, description, action, variant = "default" }: SectionHeaderProps) {
  const classes = headerVariants[variant];

  return (
    <div className={classes.root}>
      <div className="space-y-2">
        {eyebrow ? <p className={classes.eyebrow}>{eyebrow}</p> : null}
        <div className="space-y-1">
          <h2 className={classes.title}>{title}</h2>
          {description ? <p className={classes.description}>{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
