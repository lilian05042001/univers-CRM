import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth/session"
import { PasswordForm } from "@/modules/auth/components/password-form"
import { ProfileForm } from "@/modules/profile/components/profile-form"
import { getProfile } from "@/modules/profile/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile")
  return { title: t("title") }
}

export default function ProfilePage() {
  const t = useTranslations("profile")

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="flex max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("personal")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<PageSkeleton rows={2} />}>
              <ProfileSection />
            </Suspense>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("password")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

async function ProfileSection() {
  const user = await requireUser()
  const profile = await getProfile(user.id)

  return (
    <ProfileForm
      email={user.email}
      defaultValues={{ fullName: profile?.full_name ?? "", phone: profile?.phone ?? "" }}
    />
  )
}
