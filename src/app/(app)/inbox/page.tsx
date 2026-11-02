import { Suspense } from "react"

import { PageSkeleton } from "@/components/shared/page-skeleton"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { InboxScreen } from "@/modules/inbox/components/inbox-screen"

export const generateMetadata = moduleMetadata("inbox")

export default function InboxPage({ searchParams }: PageProps<"/inbox">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Inbox searchParams={searchParams} />
    </Suspense>
  )
}

async function Inbox({ searchParams }: Pick<PageProps<"/inbox">, "searchParams">) {
  return <InboxScreen searchParams={await searchParams} conversationId={null} />
}
