import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        {eyebrow ? <p className="ui-kicker">{eyebrow}</p> : null}
        <div className="space-y-1">
          <h2 className="text-90 font-display text-2xl font-bold md:text-3xl">{title}</h2>
          {description ? <p className="text-75 max-w-[44rem] text-sm leading-7">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
