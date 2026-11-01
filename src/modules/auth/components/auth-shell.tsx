import { Orbit } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

/** Pagină centrată cu logo: login, înregistrare, onboarding, invitații. */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("app")

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <span className="flex size-9 items-center justify-center rounded-md bg-sidebar text-sidebar-accent-foreground">
          <Orbit className="size-5" />
        </span>
        {t("name")}
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
