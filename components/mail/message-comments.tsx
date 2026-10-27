"use client"

import type React from "react"
import { useState } from "react"
import useSWR from "swr"
import { useSWRConfig } from "swr"
import { addMessageComment, deleteMessageComment, listMessageComments } from "@/app/actions/comments"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, Trash2 } from "lucide-react"
import { toast } from "sonner"

export function MessageComments({ messageId }: { messageId: number }) {
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const { mutate: mutateKey } = useSWRConfig()
  const { data: comments = [], isLoading, mutate } = useSWR(
    ["message-comments", messageId],
    () => listMessageComments(messageId),
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    try {
      await addMessageComment(messageId, body)
      setBody("")
      await mutate()
      await mutateKey(["message-activity", messageId])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add note")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(commentId: number) {
    try {
      await deleteMessageComment(commentId)
      await mutate()
      await mutateKey(["message-activity", messageId])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete note")
    }
  }

  return (
    <section className="mt-8 border-t border-border pt-5" aria-label="Internal notes">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquare className="h-4 w-4" /> Internal notes
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">Visible to members of your team. These notes are not included in replies.</p>

      {isLoading ? (
        <p className="py-3 text-sm text-muted-foreground">Loading notes…</p>
      ) : comments.length ? (
        <div className="mb-4 space-y-3">
          {comments.map((comment) => (
            <article key={comment.id} className="rounded-lg border border-border bg-muted/20 p-3">
              <header className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{comment.authorName}</p>
                  <time dateTime={comment.createdAt} className="text-[11px] text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString()}
                  </time>
                </div>
                {comment.canDelete && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDelete(comment.id)} aria-label="Delete note">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </header>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{comment.body}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mb-4 py-2 text-sm text-muted-foreground">No internal notes yet.</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a note for your team…"
          maxLength={5000}
          rows={3}
          aria-label="Write an internal note"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={saving || !body.trim()}>
            {saving ? "Adding…" : "Add note"}
          </Button>
        </div>
      </form>
    </section>
  )
}
