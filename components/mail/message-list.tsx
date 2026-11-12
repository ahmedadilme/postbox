"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuLabel,
} from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"
import type { MailMessage, MailAccount, FolderType, MailLabel } from "@/lib/mail/types"
import { formatListDate, initials } from "@/lib/mail/format"
import {
  Star,
  Paperclip,
  Flag,
  Search,
  RefreshCw,
  Inbox,
  Menu,
  Archive,
  Trash2,
  Mail,
  MailOpen,
  Tag,
  Reply,
  ReplyAll,
  Forward,
  ShieldCheck,
  ShieldAlert,
  Check,
} from "lucide-react"

const FOLDER_LABELS: Record<FolderType, string> = {
  inbox: "Inbox",
  sent: "Sent",
  drafts: "Drafts",
  spam: "Spam",
  archive: "Archive",
  trash: "Trash",
}

export function MessageList({
  messages,
  activeLabelName,
  labels,
  onBatchToggleLabel,
  hasMore,
  loadingMore,
  onLoadMore,
  accounts,
  selectedFolder,
  selectedId,
  search,
  loading,
  loadError,
  onSearch,
  onSelect,
  onToggleStar,
  onReply,
  onReplyAll,
  onForward,
  onSetRead,
  onMoveMessage,
  onArchiveMessage,
  onNotSpam,
  onDeleteMessage,
  onToggleLabel,
  onRefresh,
  onOpenMenu,
  searchRef,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onBatchArchive,
  onBatchDelete,
  onBatchMarkRead,
  onBatchStar,
}: {
  messages: MailMessage[]
  activeLabelName?: string
  labels: MailLabel[]
  onBatchToggleLabel: (labelId: number, add: boolean) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  accounts: MailAccount[]
  selectedFolder: FolderType
  selectedId: number | null
  search: string
  loading: boolean
  loadError?: boolean
  onSearch: (q: string) => void
  onSelect: (m: MailMessage) => void
  onToggleStar: (m: MailMessage) => void
  onReply: (m: MailMessage) => void
  onReplyAll?: (m: MailMessage) => void
  onForward?: (m: MailMessage) => void
  onSetRead: (m: MailMessage) => void
  onMoveMessage?: (m: MailMessage, folder: FolderType) => void
  onArchiveMessage: (m: MailMessage) => void
  onNotSpam: (m: MailMessage) => void
  onDeleteMessage: (m: MailMessage) => void
  onToggleLabel?: (messageId: number, labelId: number, add: boolean) => void
  onRefresh: () => void
  onOpenMenu: () => void
  searchRef?: React.RefObject<HTMLInputElement | null>
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onSelectAll: () => void
  onBatchArchive: () => void
  onBatchDelete: () => void
  onBatchMarkRead: () => void
  onBatchStar?: (isStarred: boolean) => void
}) {
  const accountColor = (id: number) => accounts.find((a) => a.id === id)?.color ?? "#2563eb"
  const batchMode = selectedIds.size > 0
  const allSelected = messages.length > 0 && messages.every((m) => selectedIds.has(m.id))
  const partiallySelected = selectedIds.size > 0 && !allSelected
  const allSelectedStarred = selectedIds.size > 0 && Array.from(selectedIds).every((id) => messages.find((m) => m.id === id)?.isStarred)

  return (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-border bg-background md:w-96 md:shrink-0">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:hidden"
              onClick={onOpenMenu}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="text-sm font-semibold text-foreground">{activeLabelName ?? FOLDER_LABELS[selectedFolder]}</h1>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} aria-label="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search mail (try from: or is:unread)"
            title="Search by from:, to:, cc:, subject:, has:attachment, is:unread/read/starred/flagged, before:YYYY-MM-DD, or after:YYYY-MM-DD. Use quotes for phrases."
            className="h-9 pl-8"
          />
        </div>
      </div>

      {/* Select all & Batch actions toolbar */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-1 border-b border-border px-3 py-1.5 transition-colors",
          batchMode ? "bg-accent/40" : "bg-muted/15"
        )}
      >
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSelectAll}
            disabled={messages.length === 0}
            className="h-7 gap-1.5 px-2 text-xs font-medium"
            title={allSelected ? "Deselect all" : `Select all ${messages.length} messages`}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                allSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : partiallySelected
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-muted-foreground/40 hover:border-muted-foreground"
              )}
            >
              {allSelected && <span className="text-[10px] font-bold leading-none">✓</span>}
              {partiallySelected && <span className="text-[10px] font-bold leading-none">−</span>}
            </span>
            <span>{allSelected ? "Deselect all" : `Select all (${messages.length})`}</span>
          </Button>
          {batchMode && (
            <span className="text-xs font-medium text-muted-foreground">· {selectedIds.size} selected</span>
          )}
        </div>

        {batchMode && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={onBatchArchive}
              title={selectedFolder === "spam" ? "Not spam (move to inbox)" : "Archive selected"}
            >
              {selectedFolder === "spam" ? <Inbox className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{selectedFolder === "spam" ? "Not spam" : "Archive"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
              onClick={onBatchDelete}
              title="Delete selected"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onBatchStar?.(!allSelectedStarred)}
              title={allSelectedStarred ? "Remove from favourites" : "Add to favourites (Star)"}
            >
              <Star className={cn("h-3.5 w-3.5", allSelectedStarred ? "text-muted-foreground" : "fill-amber-400 text-amber-500")} />
              <span className="hidden sm:inline">{allSelectedStarred ? "Unstar" : "Favourite"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={onBatchMarkRead}
              title="Mark selected as read"
            >
              <MailOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Read</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" title="Labels" />}>
                <Tag className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Labels</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">Add / remove label</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {labels.length ? labels.map((mailLabel) => (
                  <DropdownMenuSub key={mailLabel.id}>
                    <DropdownMenuSubTrigger>
                      <span className="mr-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: mailLabel.color }} />
                      {mailLabel.name}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => onBatchToggleLabel(mailLabel.id, true)}>Apply to selected</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onBatchToggleLabel(mailLabel.id, false)}>Remove from selected</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )) : <DropdownMenuItem disabled>Create a label first</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Couldn’t load this folder</p>
            <p className="text-xs text-muted-foreground">Check your connection, then try again.</p>
            <Button variant="outline" size="sm" onClick={onRefresh}>Retry</Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No messages</p>
            <p className="text-xs text-muted-foreground">
              {search ? "No results match your search." : "This folder is empty."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {messages.map((m) => {
              const active = m.id === selectedId
              const checked = selectedIds.has(m.id)
              const isMultiSelected = checked && selectedIds.size > 1

              return (
                <li key={m.id}>
                  <ContextMenu>
                    <ContextMenuTrigger className="block w-full">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(m)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            onSelect(m)
                          }
                        }}
                        className={cn(
                          "relative flex w-full cursor-pointer gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                          active && "bg-accent",
                        )}
                      >
                        {!m.isRead && (selectedFolder === "inbox" || selectedFolder === "spam") && (
                          <span className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
                        )}
                        {/* Checkbox for multi-select */}
                        <span
                          role="checkbox"
                          aria-checked={checked}
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleSelect(m.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation()
                              onToggleSelect(m.id)
                            }
                          }}
                          className={cn(
                            "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30 hover:border-muted-foreground",
                          )}
                        >
                          {checked && <span className="text-xs font-bold">✓</span>}
                        </span>
                        <span
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: accountColor(m.accountId) }}
                          aria-hidden
                        >
                          {initials(selectedFolder === "sent" || selectedFolder === "drafts" ? m.toAddresses : m.fromName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "truncate text-sm",
                                m.isRead ? "font-normal text-foreground" : "font-semibold text-foreground",
                              )}
                            >
                              {selectedFolder === "sent" || selectedFolder === "drafts"
                                ? `To: ${m.toAddresses}`
                                : m.fromName}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">{formatListDate(m.receivedAt)}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span
                              className={cn(
                                "truncate text-sm",
                                m.isRead ? "text-muted-foreground" : "font-medium text-foreground",
                              )}
                            >
                              {m.subject || "(no subject)"}
                            </span>
                          </span>
                          {!!m.labels?.length && (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {m.labels.map((mailLabel) => (
                                <span
                                  key={mailLabel.id}
                                  className="max-w-24 truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
                                  style={{ color: mailLabel.color, backgroundColor: `${mailLabel.color}18` }}
                                >
                                  {mailLabel.name}
                                </span>
                              ))}
                            </span>
                          )}
                          {m.assignment && (
                            <span className="mt-1 inline-flex max-w-full items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              <span className="truncate">Assigned to {m.assignment.name}</span>
                            </span>
                          )}
                          {m.folderType === "drafts" && m.draftShared && (
                            <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Shared with team
                            </span>
                          )}
                          <span className="mt-0.5 flex items-center gap-1.5">
                            <span className="truncate text-xs text-muted-foreground">{m.preview}</span>
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-center gap-1.5 pl-1">
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleStar(m)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation()
                                onToggleStar(m)
                              }
                            }}
                            aria-label={m.isStarred ? "Unstar" : "Star"}
                            className="text-muted-foreground hover:text-amber-500"
                          >
                            <Star className={cn("h-4 w-4", m.isStarred && "fill-amber-400 text-amber-400")} />
                          </span>
                          <span className="flex items-center gap-1">
                            {m.isFlagged && <Flag className="h-3.5 w-3.5 fill-destructive text-destructive" />}
                            {m.hasAttachments && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                          </span>
                        </span>
                      </div>
                    </ContextMenuTrigger>

                    <ContextMenuContent className="min-w-52">
                      {isMultiSelected ? (
                        <>
                          <ContextMenuLabel>{selectedIds.size} messages selected</ContextMenuLabel>
                          <ContextMenuSeparator />
                          {m.folderType !== "sent" && m.folderType !== "drafts" && (
                            <ContextMenuItem onClick={() => onReply(m)}>
                              <Reply className="h-4 w-4" /> Reply to this
                            </ContextMenuItem>
                          )}
                          <ContextMenuItem onClick={onBatchMarkRead}>
                            <MailOpen className="h-4 w-4" /> Mark selected as read
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => onBatchStar?.(!allSelectedStarred)}>
                            <Star className={cn("h-4 w-4", allSelectedStarred ? "text-muted-foreground" : "fill-amber-400 text-amber-500")} />
                            {allSelectedStarred ? "Remove star from selected" : "Star selected"}
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          {selectedFolder === "spam" ? (
                            <ContextMenuItem onClick={onBatchArchive}>
                              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Not spam (Move to inbox)
                            </ContextMenuItem>
                          ) : (
                            <ContextMenuItem onClick={onBatchArchive}>
                              <Archive className="h-4 w-4" /> Archive selected
                            </ContextMenuItem>
                          )}
                          <ContextMenuSub>
                            <ContextMenuSubTrigger>
                              <Tag className="h-4 w-4" /> Labels
                            </ContextMenuSubTrigger>
                            <ContextMenuSubContent>
                              <ContextMenuLabel>Apply to selected</ContextMenuLabel>
                              <ContextMenuSeparator />
                              {labels.length ? labels.map((mailLabel) => (
                                <ContextMenuSub key={mailLabel.id}>
                                  <ContextMenuSubTrigger>
                                    <span className="mr-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: mailLabel.color }} />
                                    {mailLabel.name}
                                  </ContextMenuSubTrigger>
                                  <ContextMenuSubContent>
                                    <ContextMenuItem onClick={() => onBatchToggleLabel(mailLabel.id, true)}>Apply to selected</ContextMenuItem>
                                    <ContextMenuItem onClick={() => onBatchToggleLabel(mailLabel.id, false)}>Remove from selected</ContextMenuItem>
                                  </ContextMenuSubContent>
                                </ContextMenuSub>
                              )) : <ContextMenuItem disabled>Create a label first</ContextMenuItem>}
                            </ContextMenuSubContent>
                          </ContextMenuSub>
                          <ContextMenuSeparator />
                          <ContextMenuItem variant="destructive" onClick={onBatchDelete}>
                            <Trash2 className="h-4 w-4" /> Delete selected
                          </ContextMenuItem>
                        </>
                      ) : (
                        <>
                          {m.folderType !== "sent" && m.folderType !== "drafts" && (
                            <ContextMenuItem onClick={() => onReply(m)}>
                              <Reply className="h-4 w-4" /> Reply
                            </ContextMenuItem>
                          )}
                          {m.folderType !== "sent" && m.folderType !== "drafts" && onReplyAll && (
                            <ContextMenuItem onClick={() => onReplyAll(m)}>
                              <ReplyAll className="h-4 w-4" /> Reply all
                            </ContextMenuItem>
                          )}
                          {m.folderType !== "drafts" && onForward && (
                            <ContextMenuItem onClick={() => onForward(m)}>
                              <Forward className="h-4 w-4" /> Forward
                            </ContextMenuItem>
                          )}
                          {m.folderType !== "sent" && m.folderType !== "drafts" && <ContextMenuSeparator />}

                          <ContextMenuItem onClick={() => onSetRead(m)}>
                            {m.isRead ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                            Mark as {m.isRead ? "unread" : "read"}
                          </ContextMenuItem>

                          <ContextMenuItem onClick={() => onToggleStar(m)}>
                            <Star className={cn("h-4 w-4", m.isStarred && "fill-amber-400 text-amber-400")} />
                            {m.isStarred ? "Remove star" : "Add to favourites (Star)"}
                          </ContextMenuItem>
                          <ContextMenuSeparator />

                          {m.folderType === "spam" || selectedFolder === "spam" ? (
                            <ContextMenuItem onClick={() => onNotSpam(m)}>
                              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Not spam (Move to inbox)
                            </ContextMenuItem>
                          ) : m.folderType === "trash" || selectedFolder === "trash" ? (
                            <ContextMenuItem onClick={() => onMoveMessage ? onMoveMessage(m, "inbox") : onNotSpam(m)}>
                              <Inbox className="h-4 w-4" /> Restore to inbox
                            </ContextMenuItem>
                          ) : (
                            <>
                              {m.folderType !== "archive" && (
                                <ContextMenuItem onClick={() => onArchiveMessage(m)}>
                                  <Archive className="h-4 w-4" /> Archive
                                </ContextMenuItem>
                              )}
                              {onMoveMessage && (
                                <ContextMenuItem onClick={() => onMoveMessage(m, "spam")}>
                                  <ShieldAlert className="h-4 w-4 text-amber-500" /> Mark as spam
                                </ContextMenuItem>
                              )}
                            </>
                          )}

                          <ContextMenuSub>
                            <ContextMenuSubTrigger>
                              <Tag className="h-4 w-4" /> Labels
                            </ContextMenuSubTrigger>
                            <ContextMenuSubContent>
                              <ContextMenuLabel>Labels</ContextMenuLabel>
                              <ContextMenuSeparator />
                              {labels.length ? labels.map((mailLabel) => {
                                const hasLabel = m.labels?.some((l) => l.id === mailLabel.id)
                                return (
                                  <ContextMenuItem
                                    key={mailLabel.id}
                                    onClick={() => onToggleLabel?.(m.id, mailLabel.id, !hasLabel)}
                                  >
                                    <span className="mr-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: mailLabel.color }} />
                                    <span className="flex-1">{mailLabel.name}</span>
                                    {hasLabel && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                                  </ContextMenuItem>
                                )
                              }) : <ContextMenuItem disabled>Create a label first</ContextMenuItem>}
                            </ContextMenuSubContent>
                          </ContextMenuSub>

                          <ContextMenuSeparator />
                          <ContextMenuItem variant="destructive" onClick={() => onDeleteMessage(m)}>
                            <Trash2 className="h-4 w-4" /> {m.folderType === "trash" ? "Delete forever" : "Delete (Move to trash)"}
                          </ContextMenuItem>
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                </li>
              )
            })}
          </ul>
        )}
        {hasMore && (
          <div className="flex justify-center border-t border-border p-3">
            <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading older messages…" : "Load older messages"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
