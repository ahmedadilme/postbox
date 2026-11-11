"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { MailMessage, MailAccount, MailLabel } from "@/lib/mail/types"
import { formatFullDate, initials, formatBytes } from "@/lib/mail/format"
import {
  Reply,
  ReplyAll,
  Forward,
  Archive,
  Trash2,
  Star,
  Flag,
  MailOpen,
  Mail as MailIcon,
  Paperclip,
  MoreHorizontal,
  Mails,
  Clock,
  ChevronDown,
  Tag,
  Inbox,
} from "lucide-react"
import { SnoozePicker } from "./snooze-picker"
import { MessageComments } from "./message-comments"
import { MessageAssignment } from "./message-assignment"
import { MessageActivity } from "./message-activity"

export function ReadingPane({
  message,
  accounts,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onToggleStar,
  onToggleFlag,
  onToggleRead,
  onSnooze,
  onUnsnooze,
  onEditDraft,
  labels,
  onToggleLabel,
  onAssignmentChanged,
}: {
  message: MailMessage | null
  accounts: MailAccount[]
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onArchive: () => void
  onDelete: () => void
  onToggleStar: () => void
  onToggleFlag: () => void
  onToggleRead: () => void
  onSnooze?: (until: Date) => void
  onUnsnooze?: () => void
  onEditDraft?: () => void
  labels: MailLabel[]
  onToggleLabel: (labelId: number, add: boolean) => void
  onAssignmentChanged: () => void
}) {
  if (!message) {
    return (
      <div className="hidden flex-1 flex-col items-center justify-center gap-3 bg-muted/30 md:flex">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Mails className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Select a message to read</p>
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          Choose a conversation from the list to view its contents here.
        </p>
      </div>
    )
  }

  const account = accounts.find((a) => a.id === message.accountId)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-1 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        {message.folderType === "drafts" ? (
          <Button variant="ghost" size="sm" className="gap-2" onClick={onEditDraft}>
            <Reply className="h-4 w-4" />
            <span>Edit draft</span>
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" className="gap-2" onClick={onReply}>
              <Reply className="h-4 w-4" />
              <span className="hidden sm:inline">Reply</span>
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={onReplyAll}>
              <ReplyAll className="h-4 w-4" />
              <span className="hidden lg:inline">Reply all</span>
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={onForward}>
              <Forward className="h-4 w-4" />
              <span className="hidden lg:inline">Forward</span>
            </Button>
          </>
        )}
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onArchive} aria-label={message.folderType === "spam" ? "Move to inbox" : "Archive"}>
          {message.folderType === "spam" ? <Inbox className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete} aria-label="Delete">
          <Trash2 className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label="Manage labels" />}
          >
            <Tag className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {labels.length ? labels.map((mailLabel) => {
              const applied = message.labels?.some((item) => item.id === mailLabel.id) ?? false
              return (
                <DropdownMenuItem key={mailLabel.id} onClick={() => onToggleLabel(mailLabel.id, !applied)}>
                  <span className="flex h-4 w-4 items-center justify-center text-xs">{applied ? "✓" : ""}</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: mailLabel.color }} />
                  {mailLabel.name}
                </DropdownMenuItem>
              )
            }) : <DropdownMenuItem disabled>Create a label first</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleStar}
            aria-label={message.isStarred ? "Unstar" : "Star"}
          >
            <Star className={cn("h-4 w-4", message.isStarred && "fill-amber-400 text-amber-400")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleFlag}
            aria-label={message.isFlagged ? "Unflag" : "Flag"}
          >
            <Flag className={cn("h-4 w-4", message.isFlagged && "fill-destructive text-destructive")} />
          </Button>
          {onSnooze && (
            <SnoozePicker
              onSnooze={onSnooze}
              onUnsnooze={onUnsnooze}
              isSnoozed={!!message.snoozedUntil}
            >
              <Clock className="h-4 w-4" />
            </SnoozePicker>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label="More actions" />}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggleRead}>
                {message.isRead ? (
                  <>
                    <MailIcon className="h-4 w-4" />
                    Mark as unread
                  </>
                ) : (
                  <>
                    <MailOpen className="h-4 w-4" />
                    Mark as read
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                {message.folderType === "spam" ? <Inbox className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                {message.folderType === "spam" ? "Not spam · move to inbox" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <article className="mx-auto max-w-4xl px-5 py-6 sm:px-8 sm:py-8">
          <h1 className="mb-6 break-words text-2xl font-normal tracking-tight text-foreground sm:text-[28px]">
            {message.subject || "(no subject)"}
          </h1>

          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: account?.color ?? "#2563eb" }}
              aria-hidden
            >
              {initials(message.fromName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{message.fromName}</p>
                  <p className="truncate text-xs text-muted-foreground">{message.fromAddress}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatFullDate(message.receivedAt)}</span>
              </div>
              <details className="group mt-1 text-xs text-muted-foreground">
                <summary className="inline-flex max-w-full cursor-pointer list-none items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="truncate">to {message.toAddresses || "undisclosed recipients"}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                  <dt className="text-muted-foreground">From</dt>
                  <dd className="break-all text-foreground">{message.fromName} &lt;{message.fromAddress}&gt;</dd>
                  <dt className="text-muted-foreground">To</dt>
                  <dd className="break-all text-foreground">{message.toAddresses || "undisclosed recipients"}</dd>
                  {message.ccAddresses && <>
                    <dt className="text-muted-foreground">Cc</dt>
                    <dd className="break-all text-foreground">{message.ccAddresses}</dd>
                  </>}
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="text-foreground">{formatFullDate(message.receivedAt)}</dd>
                </dl>
              </details>
            </div>
          </div>

          {message.folderType !== "drafts" && (
            <div className="mt-3">
              <MessageAssignment
                messageId={message.id}
                assignedUserId={message.assignment?.userId ?? null}
                onChanged={onAssignmentChanged}
              />
            </div>
          )}

          <Separator className="my-6" />

          {message.htmlBody ? (
            <div
              className="max-w-full overflow-x-auto break-words text-[15px] leading-7 text-foreground [&_a]:text-primary [&_a]:underline [&_table]:max-w-full"
              dangerouslySetInnerHTML={{ __html: message.htmlBody }}
            />
          ) : (
            <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground">
              {message.body || <span className="text-sm italic text-muted-foreground">This message has no text content.</span>}
            </div>
          )}

          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                {message.attachments.length} attachment{message.attachments.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={`/api/attachments/${a.id}`}
                    download={a.filename}
                    aria-label={`Download ${a.filename}`}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground">
                      <Paperclip className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-40 truncate text-xs font-medium text-foreground">{a.filename}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(a.size)}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
          {message.folderType !== "drafts" && <>
            <MessageComments messageId={message.id} />
            <MessageActivity messageId={message.id} />
          </>}
          <div className="mt-8 border-t border-border pt-5">
            <Button
              variant="outline"
              className="gap-2 rounded-full px-5"
              onClick={message.folderType === "drafts" ? onEditDraft : onReply}
            >
              <Reply className="h-4 w-4" /> {message.folderType === "drafts" ? "Edit draft" : "Reply"}
            </Button>
          </div>
        </article>
      </div>
    </div>
  )
}
