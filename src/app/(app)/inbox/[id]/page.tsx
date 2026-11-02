import { Suspense } from "react"

import { PageSkeleton } from "@/components/shared/page-skeleton"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { InboxScreen } from "@/modules/inbox/components/inbox-screen"

export const generateMetadata = moduleMetadata("inbox")

export default function ConversationPage({ params, searchParams }: PageProps<"/inbox/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Conversation params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Conversation({ params, searchParams }: PageProps<"/inbox/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  return <InboxScreen searchParams={query} conversationId={id} />
}
