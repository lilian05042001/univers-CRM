import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/shared/page-skeleton"
import { Button } from "@/components/ui/button"
import { getSessionUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { AuthCard } from "@/modules/auth/components/auth-card"
import { AuthShell } from "@/modules/auth/components/auth-shell"
import { AcceptInvitationButton } from "@/modules/organizations/components/accept-invitation-button"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite")
  return { title: t("title") }
}

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <AuthShell>
      <Suspense fallback={<PageSkeleton rows={2} />}>
        <Invitation params={params} />
      </Suspense>
    </AuthShell>
  )
}

async function Invitation({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params
  const t = await getTranslations("invite")
  const supabase = await createClient()
  const [{ data }, user] = await Promise.all([
    supabase.rpc("get_invitation", { p_token: token }),
    getSessionUser(),
  ])
  const invitation = data?.[0]

  if (!invitation?.is_valid) {
    return (
      <AuthCard title={t("invalidTitle")} description={t("invalidDescription")}>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{t("toLogin")}</Link>
        </Button>
      </AuthCard>
    )
  }

  const next = encodeURIComponent(`/invite/${token}`)
  const email = encodeURIComponent(invitation.email)
  const description = t("description", {
    organization: invitation.organization_name,
    role: invitation.role_name,
  })

  if (!user) {
    return (
      <AuthCard title={t("title")} description={description}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {t("forEmail", { email: invitation.email })}
          </p>
          <Button asChild>
            <Link href={`/register?next=${next}&email=${email}`}>{t("createAccount")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/login?next=${next}&email=${email}`}>{t("haveAccount")}</Link>
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t("title")} description={description}>
      {user.email.toLowerCase() === invitation.email ? (
        <AcceptInvitationButton token={token} />
      ) : (
        <p className="text-sm text-destructive">
          {t("wrongAccount", { email: invitation.email, current: user.email })}
        </p>
      )}
    </AuthCard>
  )
}
