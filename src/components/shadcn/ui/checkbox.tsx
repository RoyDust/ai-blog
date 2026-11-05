"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 cursor-pointer rounded-[2px] border border-[var(--reader-border-strong)] bg-transparent shadow-none transition-[background-color,border-color] duration-150 outline-none hover:not-disabled:border-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--danger-foreground)] data-[state=checked]:border-[var(--foreground)] data-[state=checked]:bg-[var(--foreground)] data-[state=checked]:text-[var(--card-bg)] data-[state=indeterminate]:border-[var(--foreground)] data-[state=indeterminate]:bg-[var(--foreground)] data-[state=indeterminate]:text-[var(--card-bg)]",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
