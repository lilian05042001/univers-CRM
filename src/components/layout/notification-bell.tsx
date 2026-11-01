"use client"

import { Bell, CheckCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFormatter, useNow, useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getBrowserClient } from "@/lib/supabase/client"
import {
  listMyNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "@/modules/notifications/actions"

/** Clopoțelul: necitite, ultimele 20 de notificări, actualizare în timp real (Supabase Realtime). */
export function NotificationBell({ userId }: { userId: string }) {
  const t = useTranslations("notifications")
  const format = useFormatter()
  const now = useNow()
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)

  const load = useCallback(async () => {
    const result = await listMyNotifications()
    if (result.ok) {
      setItems(result.data.items)
      setUnread(result.data.unread)
    }
  }, [])

  useEffect(() => {
    // Încărcarea inițială are loc după montare (date per utilizator, fără randare pe server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const supabase = getBrowserClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { title?: string; type?: string }
          toast.info(t(`types.${row.type ?? "task_due_soon"}`), { description: row.title })
          void load()
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, load, t])

  async function open(item: NotificationItem) {
    if (!item.readAt) await markNotificationsRead({ ids: [item.id] })
    void load()
    if (item.link) router.push(item.link)
  }

  async function markAll() {
    await markNotificationsRead({})
    void load()
  }

  return (
    <DropdownMenu onOpenChange={(o) => o && void load()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? t("titleUnread", { count: unread }) : t("title")}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          {t("title")}
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7" onClick={markAll}>
              <CheckCheck />
              {t("markAll")}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => void open(item)}
                className="items-start gap-2 py-2"
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : item.type === "task_overdue" ? "bg-destructive" : "bg-primary"}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">
                    {t(`types.${item.type}`)}
                  </span>
                  <span className={`block truncate text-sm ${item.readAt ? "" : "font-medium"}`}>
                    {item.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {format.relativeTime(new Date(item.createdAt), now)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
