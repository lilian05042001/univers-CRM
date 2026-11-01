import { cn } from "cn"

/** Etichetă colorată (culoarea vine din setările organizației). */
export function TagBadge({
  name,
  color,
  className,
}: {
  name: string
  color: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-40 items-center truncate rounded-full border px-2 text-xs font-medium",
        className
      )}
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}
    >
      {name}
    </span>
  )
}
