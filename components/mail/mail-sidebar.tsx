"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { MailAccount, FolderType, FolderCount, MailLabel } from "@/lib/mail/types"
import { FOLDERS } from "@/lib/mail/types"
import {
  Inbox, Send, FileText, Archive, Trash2, ShieldAlert, Plus, Mail, MoreVertical,
  Layers, PenSquare, RefreshCw, AlertCircle, Folder, FolderPlus,
  Star, Paperclip, MailOpen, Clock, Tag, UserCheck,
} from "lucide-react"

const FOLDER_ICONS: Record<FolderType, typeof Inbox> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  spam: ShieldAlert,
  archive: Archive,
  trash: Trash2,
}

export interface SidebarCustomFolder {
  id: number
  accountId: number
  name: string
}

export function MailSidebar({
  accounts,
  counts,
  selectedAccount,
  selectedFolder,
  onSelectAccount,
  onSelectFolder,
  onCompose,
  onAddAccount,
  onRemoveAccount,
  onEditAccount,
  onSyncAccount,
  syncingAccounts,
  customFolders,
  onSelectCustomFolder,
  onCreateFolder,
  onDeleteFolder,
  selectedCustomFolderId,
  selectedSmartFolder,
  onSelectSmartFolder,
  labels,
  selectedLabelId,
  onSelectLabel,
  onCreateLabel,
  onDeleteLabel,
  planBadge,
}: {
  accounts: MailAccount[]
  counts: FolderCount[]
  selectedAccount: number | "all"
  selectedFolder: FolderType
  onSelectAccount: (id: number | "all") => void
  onSelectFolder: (f: FolderType) => void
  onCompose: () => void
  onAddAccount: () => void
  onRemoveAccount: (id: number) => void
  onEditAccount: (id: number) => void
  onSyncAccount: (id: number) => void
  syncingAccounts: number[]
  customFolders: SidebarCustomFolder[]
  onSelectCustomFolder: (folder: SidebarCustomFolder) => void
  onCreateFolder: () => void
  onDeleteFolder: (id: number) => void
  selectedCustomFolderId: number | null
  selectedSmartFolder: string | null
  onSelectSmartFolder: (type: string | null) => void
  labels: MailLabel[]
  selectedLabelId: number | null
  onSelectLabel: (labelId: number | null) => void
  onCreateLabel: () => void
  onDeleteLabel: (labelId: number) => void
  planBadge?: string
}) {
  const countFor = (f: FolderType) => counts.find((c) => c.folderType === f)

  const accountFolders = selectedAccount === "all"
    ? customFolders
    : customFolders.filter((f) => f.accountId === selectedAccount)

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Mail className="h-4 w-4" />
        </div>
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">Postbox</span>
        {planBadge && planBadge !== "free" && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
            {planBadge}
          </span>
        )}
      </div>

      <div className="px-3 pb-3">
        <Button onClick={onCompose} className="w-full justify-start gap-2" size="sm">
          <PenSquare className="h-4 w-4" />
          Compose
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 pb-4">
          {/* Standard folders */}
          <nav className="flex flex-col gap-0.5">
            {FOLDERS.map(({ type, label }) => {
              const Icon = FOLDER_ICONS[type]
              const c = countFor(type)
              const badge = type === "inbox" || type === "spam" ? c?.unread : type === "drafts" ? c?.total : undefined
              const active = selectedFolder === type && !selectedCustomFolderId && !selectedLabelId && !selectedSmartFolder
              return (
                <button
                  key={type}
                  onClick={() => onSelectFolder(type)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {badge ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs tabular-nums",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>

          {/* Smart folders */}
          <div className="mt-4">
            <div className="flex items-center justify-between px-3 pb-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Smart</span>
            </div>
            <nav className="flex flex-col gap-0.5">
              {[
                { type: "starred", label: "Starred", Icon: Star },
                { type: "attachments", label: "With Attachments", Icon: Paperclip },
                { type: "unread", label: "Unread", Icon: MailOpen },
                { type: "snoozed", label: "Snoozed", Icon: Clock },
                { type: "assigned", label: "Assigned to me", Icon: UserCheck },
              ].map(({ type, label, Icon }) => (
                <button
                  key={type}
                  onClick={() => {
                    onSelectSmartFolder(selectedSmartFolder === type ? null : type)
                    if (selectedSmartFolder !== type) onSelectFolder("inbox")
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    selectedSmartFolder === type
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-left">{label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* User labels */}
          <div className="mt-4">
            <div className="flex items-center justify-between px-3 pb-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Labels</span>
              <button onClick={onCreateLabel} className="text-muted-foreground hover:text-foreground" aria-label="Create label">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5">
              {labels.map((mailLabel) => (
                <div key={mailLabel.id} className="group flex items-center">
                  <button
                    onClick={() => onSelectLabel(selectedLabelId === mailLabel.id ? null : mailLabel.id)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      selectedLabelId === mailLabel.id
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                    )}
                  >
                    <Tag className="h-4 w-4 shrink-0" style={{ color: mailLabel.color }} />
                    <span className="truncate text-left">{mailLabel.name}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="shrink-0 pr-2 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      aria-label={`Manage ${mailLabel.name}`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeleteLabel(mailLabel.id)}>
                        Delete label
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </nav>
          </div>

          {/* Custom folders */}
          {accountFolders.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between px-3 pb-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Folders</span>
                <button
                  onClick={onCreateFolder}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Create folder"
                >
                  <FolderPlus className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex flex-col gap-0.5">
                {accountFolders.map((f) => (
                  <div key={f.id} className="group flex items-center">
                    <button
                      onClick={() => onSelectCustomFolder(f)}
                      className={cn(
                        "flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        selectedCustomFolderId === f.id
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                      )}
                    >
                      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-left">{f.name}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="shrink-0 pr-2 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                        aria-label={`Manage ${f.name}`}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeleteFolder(f.id)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </nav>
            </div>
          )}

          {/* Accounts */}
          <div className="mt-6">
            <div className="flex items-center justify-between px-3 pb-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accounts</span>
              <button
                onClick={onAddAccount}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Add account"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => onSelectAccount("all")}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                selectedAccount === "all"
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Layers className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">All inboxes</span>
            </button>

            {accounts.map((a) => {
              const isSyncing = syncingAccounts.includes(a.id) || a.syncStatus === "syncing"
              return (
              <div
                key={a.id}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  selectedAccount === a.id
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}
              >
                <button
                  onClick={() => onSelectAccount(a.id)}
                  className="flex min-w-0 flex-1 items-center gap-3"
                  title={a.syncStatus === "error"
                    ? `Sync failed: ${a.syncError || "Select Sync now to retry."}`
                    : a.syncStatus === "syncing"
                      ? "Mail sync is in progress"
                      : a.lastSyncAt
                        ? `Last synced ${new Date(a.lastSyncAt).toLocaleString()}`
                        : "This account has not synced yet"}
                >
                  <span className="relative h-2.5 w-2.5 shrink-0">
                    <span className="absolute inset-0 rounded-full" style={{ backgroundColor: a.color }} />
                    {a.syncStatus === "error" && (
                      <span className="absolute -right-1 -top-1" title={a.syncError || "Mail sync failed. Select Sync now to retry."}>
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{a.emailAddress}</span>
                </button>
                {isSyncing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSyncAccount(a.id) }}
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    aria-label={`Sync ${a.emailAddress}`}
                    title="Sync now"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    aria-label={`Manage ${a.emailAddress}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onSelectAccount(a.id)}>Open</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onEditAccount(a.id)}>Edit account</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onRemoveAccount(a.id)}>
                      Remove account
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )})}

            {accounts.length === 0 && (
              <button
                onClick={onAddAccount}
                className="mt-1 flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Add your first account
              </button>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
