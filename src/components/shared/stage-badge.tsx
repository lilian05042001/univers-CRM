/** Etapa unui lead, cu culoarea configurată în pipeline. */
export function StageBadge({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex max-w-48 items-center gap-1.5 truncate text-sm">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="truncate">{name}</span>
    </span>
  )
}
