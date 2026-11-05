import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-[4px] border border-[var(--reader-border-strong)] bg-transparent px-3 py-2 text-base leading-relaxed text-[var(--foreground)] shadow-none transition-[border-color,background-color] duration-150 outline-none placeholder:text-[var(--text-muted)] hover:not-disabled:border-[var(--text-muted)] focus-visible:border-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-[var(--danger-foreground)] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
