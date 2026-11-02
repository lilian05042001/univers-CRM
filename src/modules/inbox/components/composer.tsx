"use client"

import { Paperclip, Send, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useRef, useState, type KeyboardEvent } from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { getBrowserClient } from "@/lib/supabase/client"
import { FILES_BUCKET } from "@/modules/files/constants"

import { prepareAttachment, sendMessage } from "../actions"
import type { QuickReply } from "../queries"
import { MAX_ATTACHMENTS, type AttachmentInput, type MessageMode } from "../schemas"

import { QuickReplyPicker, matchShortcut } from "./quick-reply-picker"

/** Răspuns / mesaj primit (canal intern) / notă internă, cu atașamente și răspunsuri rapide. */
export function Composer({
  conversationId,
  allowInbound,
  quickReplies,
}: {
  conversationId: string
  allowInbound: boolean
  quickReplies: QuickReply[]
}) {
  const t = useTranslations("inbox.composer")
  const tAll = useTranslations()
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<MessageMode>("reply")
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const suggestions = matchShortcut(body, quickReplies)

  function insertReply(reply: QuickReply) {
    setBody((current) =>
      matchShortcut(current, quickReplies) || !current.trim()
        ? reply.body
        : `${current}\n${reply.body}`
    )
  }

  async function uploadAll(): Promise<AttachmentInput[] | null> {
    const supabase = getBrowserClient()
    const uploaded: AttachmentInput[] = []
    for (const file of files) {
      const prepared = await prepareAttachment({
        conversationId,
        fileName: file.name,
        size: file.size,
      })
      if (!prepared.ok) {
        toast.error(`${file.name}: ${tAll(prepared.error)}`)
        return null
      }
      const { error } = await supabase.storage
        .from(FILES_BUCKET)
        .upload(prepared.data.path, file, { contentType: file.type || undefined })
      if (error) {
        toast.error(`${file.name}: ${tAll("files.uploadFailed")}`)
        return null
      }
      uploaded.push({
        path: prepared.data.path,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      })
    }
    return uploaded
  }

  async function send() {
    if (sending || (!body.trim() && (mode === "note" || files.length === 0))) return
    setSending(true)
    try {
      const attachments = mode === "note" ? [] : await uploadAll()
      if (!attachments) return
      const result = await sendMessage({ conversationId, mode, body: body.trim(), attachments })
      if (!result.ok) {
        toast.error(tAll(result.fieldErrors?.body ?? result.error))
        return
      }
      setBody("")
      setFiles([])
      router.refresh()
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    if (suggestions[0]) insertReply(suggestions[0])
    else void send()
  }

  return (
    <div className="border-t p-3">
      <Tabs value={mode} onValueChange={(v) => setMode(v as MessageMode)} className="mb-2">
        <TabsList>
          <TabsTrigger value="reply">{t("reply")}</TabsTrigger>
          {allowInbound && <TabsTrigger value="inbound">{t("inbound")}</TabsTrigger>}
          <TabsTrigger value="note">{t("note")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {suggestions.length > 0 && (
        <ul
          className="mb-2 rounded-md border bg-popover text-sm shadow-sm"
          aria-label={t("quickReplies")}
        >
          {suggestions.map((reply) => (
            <li key={reply.id}>
              <button
                type="button"
                className="flex w-full gap-2 px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => insertReply(reply)}
              >
                <span className="font-mono text-xs text-muted-foreground">/{reply.shortcut}</span>
                <span className="truncate">{reply.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        maxLength={10000}
        aria-label={t(`placeholder.${mode}`)}
        placeholder={t(`placeholder.${mode}`)}
        className={cn(
          "max-h-48 resize-none",
          mode === "note" &&
            "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
        )}
      />

      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
            >
              <Paperclip className="size-3" />
              <span className="max-w-40 truncate">{file.name}</span>
              <button
                type="button"
                aria-label={t("removeFile", { name: file.name })}
                onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-center gap-1">
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          aria-label={t("attach")}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? [])
            setFiles((list) => [...list, ...picked].slice(0, MAX_ATTACHMENTS))
            e.target.value = ""
          }}
        />
        {mode !== "note" && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("attach")}
            onClick={() => input.current?.click()}
          >
            <Paperclip />
          </Button>
        )}
        <QuickReplyPicker replies={quickReplies} onPick={insertReply} />
        <span className="flex-1 text-xs text-muted-foreground max-sm:hidden">{t("hint")}</span>
        <Button
          type="button"
          size="sm"
          onClick={() => void send()}
          disabled={sending}
          className="ml-auto"
        >
          {sending ? <Spinner /> : <Send />}
          {t(`send.${mode}`)}
        </Button>
      </div>
    </div>
  )
}
