import {
  AtSign,
  Camera,
  Globe,
  Mail,
  MessageCircle,
  MessagesSquare,
  Phone,
  type LucideIcon,
} from "lucide-react"

import type { ChannelProvider } from "@/lib/channels/types"

const ICONS: Record<ChannelProvider, LucideIcon> = {
  internal: MessagesSquare,
  whatsapp: MessageCircle,
  instagram: Camera,
  messenger: AtSign,
  email: Mail,
  telephony: Phone,
  web_form: Globe,
}

export function ChannelIcon({
  provider,
  className,
}: {
  provider: ChannelProvider
  className?: string
}) {
  const Icon = ICONS[provider] ?? MessagesSquare
  return <Icon className={className ?? "size-3.5"} aria-hidden />
}
