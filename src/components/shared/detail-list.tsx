import type { ReactNode } from "react"

/** Listă etichetă–valoare pentru cardurile de informații din fișe. Valorile goale sunt omise. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  const visible = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== "")
  return (
    <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2.5 text-sm">
      {visible.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
