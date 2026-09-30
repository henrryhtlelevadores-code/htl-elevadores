"use client"

import * as React from "react"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"

import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Root>) {
  return (
    <label
      data-slot="radio-group-item"
      className={cn(
        "flex cursor-pointer items-center gap-2 text-sm font-medium select-none",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
    >
      <RadioPrimitive.Root
        data-slot="radio-group-item-indicator"
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input",
          "bg-transparent text-white transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          "data-disabled:cursor-not-allowed data-disabled:opacity-50",
          "data-checked:border-[#0066CC] data-checked:bg-[#0066CC]",
          "dark:bg-input/30"
        )}
        {...props}
      >
        <RadioPrimitive.Indicator
          data-slot="radio-group-item-indicator"
          className="flex items-center justify-center text-current"
        >
          <span className="size-1.5 rounded-full bg-current" />
        </RadioPrimitive.Indicator>
      </RadioPrimitive.Root>
      {children}
    </label>
  )
}

export { RadioGroup, RadioGroupItem }
