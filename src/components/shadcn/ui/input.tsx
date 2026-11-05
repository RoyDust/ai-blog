import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 方向 A 控件：36px、4px 圆角、1px 强描边、透明底；hover 描边变 muted，错误 danger 描边
        "h-9 w-full min-w-0 rounded-[4px] border border-[var(--reader-border-strong)] bg-transparent px-3 py-1 text-base text-[var(--foreground)] shadow-none transition-[border-color,background-color] duration-150 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--foreground)] placeholder:text-[var(--text-muted)] hover:not-disabled:border-[var(--text-muted)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 md:text-sm",
        "focus-visible:border-[var(--foreground)]",
        "aria-invalid:border-[var(--danger-foreground)] aria-invalid:hover:border-[var(--danger-foreground)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
