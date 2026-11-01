import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type { ComponentProps } from "react"

const statusBadgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        info: "bg-info/10 text-info",
        success: "bg-success/10 text-success",
        warning: "bg-warning/15 text-warning",
        danger: "bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

export type StatusTone = NonNullable<VariantProps<typeof statusBadgeVariants>["tone"]>

type StatusBadgeProps = ComponentProps<"span"> &
  VariantProps<typeof statusBadgeVariants> & {
    /** Afișează un punct colorat înaintea textului. */
    dot?: boolean
  }

export function StatusBadge({ tone, dot, className, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}
