"use client"

import { useState, useCallback, useRef } from "react"
import useSWR from "swr"
import useSWRInfinite from "swr/infinite"
import { MailHeader } from "./mail-header"
import { MailSidebar } from "./mail-sidebar"
import { MessageList } from "./message-list"
import { ReadingPane } from "./reading-pane"
import { AddAccountDialog } from "./add-account-dialog"
import { ComposeDialog, type ComposeInitial } from "./compose-dialog"
import { RemoveAccountDialog } from "./remove-account-dialog"
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay"
import { getUserTeamInfo } from "@/app/actions/onboarding"
import { getAccounts, syncAccount } from "@/app/actions/accounts"
import { listFolders, deleteFolder, type CustomFolder } from "@/app/actions/folders"
import { listLabels, deleteLabel, toggleLabelOnMessage, toggleLabelOnMessages } from "@/app/actions/labels"
import { CreateFolderDialog } from "./create-folder-dialog"
import { CreateLabelDialog } from "./create-label-dialog"
import { EditAccountDialog } from "./edit-account-dialog"
import {
  listMessages,
  getMessage,
  getFolderCounts,
  setRead,
  toggleStar as toggleStarAction,
  toggleFlag as toggleFlagAction,
  moveToFolder,
  deleteForever,
  snoozeMessage,
  unsnoozeMessage,
} from "@/app/actions/messages"
import type { MailMessage, FolderType, MailAccount, MailLabel } from "@/lib/mail/types"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { useKeyboardShortcuts, type ShortcutAction } from "@/lib/use-keyboard-shortcuts"
import { useDesktopNotifications } from "@/lib/use-desktop-notifications"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type MessageCursor = { receivedAt: string; id: number }
type MessagePage = { messages: MailMessage[]; nextCursor: MessageCursor | null }
type MessagePageKey = readonly [string, number | "all", FolderType, string | null, string, number | null, MessageCursor | null]

export function MailDashboard({ user, needsOnboarding }: { user: { name: string; email: string }; needsOnboarding?: boolean }) {
  const [selectedAccount, setSelectedAccount] = useState<number | "all">("all")
  const [selectedFolder, setSelectedFolder] = useState<FolderType>("inbox")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 300)

  const [addOpen, setAddOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeInitial, setComposeInitial] = useState<ComposeInitial | undefined>(undefined)
  const [removeId, setRemoveId] = useState<number | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [syncingAccounts, setSyncingAccounts] = useState<number[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectedCustomFolderId, setSelectedCustomFolderId] = useState<number | null>(null)
  const [selectedSmartFolder, setSelectedSmartFolder] = useState<string | null>(null)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [labelDialogOpen, setLabelDialogOpen] = useState(false)
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null)
  const [editAccount, setEditAccount] = useState<MailAccount | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding ?? false)

  const { data: accounts = [], mutate: mutateAccounts } = useSWR("accounts", () => getAccounts())
  const { data: labels = [], mutate: mutateLabels } = useSWR<MailLabel[]>("labels", () => listLabels())
  const { data: counts = [], mutate: mutateCounts } = useSWR(["counts", selectedAccount], () =>
    getFolderCounts(selectedAccount),
  )
  const {
    data: messagePages,
    error: messageError,
    isLoading,
    isValidating: isLoadingMore,
    size: messagePageCount,
    setSize: setMessagePageCount,
    mutate: mutateMessages,
  } = useSWRInfinite<MessagePage, Error, (pageIndex: number, previousPageData: MessagePage | null) => MessagePageKey | null>(
    (pageIndex, previousPageData) => {
      if (pageIndex > 0 && !previousPageData?.nextCursor) return null
      return [
        "messages",
        selectedAccount,
        selectedFolder,
        selectedSmartFolder,
        debouncedSearch,
        selectedLabelId,
        pageIndex === 0 ? null : previousPageData!.nextCursor,
      ]
    },
    ([, accountId, folderType, smartFolder, query, labelId, cursor]) => listMessages({
      accountId,
      folderType,
      smartFolder: smartFolder ?? undefined,
      search: query,
      labelId,
      cursor,
    }),
  )
  const messages = messagePages?.flatMap((page) => page.messages) ?? []
  const hasMoreMessages = Boolean(messagePages?.at(-1)?.nextCursor)
  const { data: teamInfo } = useSWR("team-info", () => getUserTeamInfo())
  const planBadge = teamInfo?.team?.plan ?? "free"

  const { data: customFolders = [], mutate: mutateFolders } = useSWR(
    ["folders", selectedAccount],
    () => listFolders(selectedAccount === "all" ? undefined : selectedAccount),
  )

  const { data: openMessage = null, mutate: mutateOpen } = useSWR(
    selectedId ? ["message", selectedId] : null,
    () => getMessage(selectedId as number),
  )

  const handleSyncAccount = useCallback(async (accountId: number) => {
    setSyncingAccounts((prev) => [...prev, accountId])
    try {
      await syncAccount(accountId)
      mutateMessages()
      mutateCounts()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not sync this account"
      toast.error(message)
    } finally {
      setSyncingAccounts((prev) => prev.filter((id) => id !== accountId))
      mutateAccounts()
    }
  }, [mutateMessages, mutateCounts, mutateAccounts])

  const handleSelectCustomFolder = useCallback((f: { id: number; accountId: number; name: string }) => {
    setSelectedCustomFolderId(f.id)
    setSelectedLabelId(null)
    setSelectedSmartFolder(null)
    setSelectedFolder("inbox")
    setSelectedId(null)
  }, [])

  const handleDeleteCustomFolder = useCallback(async (id: number) => {
    await deleteFolder(id)
    if (selectedCustomFolderId === id) setSelectedCustomFolderId(null)
    mutateFolders()
  }, [selectedCustomFolderId, mutateFolders])

  const refreshAll = useCallback(() => {
    mutateMessages()
    mutateCounts()
    mutateAccounts()
    mutateOpen()
    mutateFolders()
  }, [mutateMessages, mutateCounts, mutateAccounts, mutateOpen, mutateFolders])

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = messages.length > 0 && messages.every((m) => prev.has(m.id))
      if (allSelected) return new Set()
      return new Set(messages.map((m) => m.id))
    })
  }, [messages])

  const handleBatchArchive = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await moveToFolder(ids, selectedFolder === "spam" ? "inbox" : "archive")
    setSelectedIds(new Set())
    refreshAll()
  }, [selectedIds, refreshAll])

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (selectedFolder === "trash") {
      await deleteForever(ids)
    } else {
      await moveToFolder(ids, "trash")
    }
    setSelectedIds(new Set())
    refreshAll()
  }, [selectedIds, selectedFolder, refreshAll])

  const handleBatchMarkRead = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await setRead(ids, true)
    setSelectedIds(new Set())
    refreshAll()
  }, [selectedIds, refreshAll])

  const handleBatchStar = useCallback(async (isStarred: boolean = true) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await toggleStarAction(ids, isStarred)
    setSelectedIds(new Set())
    refreshAll()
  }, [selectedIds, refreshAll])

  const handleSelectMessage = useCallback(
    async (m: MailMessage) => {
      setSelectedId(m.id)
      if (!m.isRead) {
        await setRead(m.id, true)
        mutateMessages()
        mutateCounts()
      }
    },
    [mutateMessages, mutateCounts],
  )

  const handleToggleStarInList = useCallback(
    async (m: MailMessage) => {
      await toggleStarAction(m.id, !m.isStarred)
      mutateMessages()
      if (m.id === selectedId) mutateOpen()
    },
    [mutateMessages, mutateOpen, selectedId],
  )

  function openCompose(initial?: ComposeInitial) {
    setComposeInitial(initial)
    setComposeOpen(true)
  }

  function quotePrefix(m: MailMessage) {
    return `\n\n\n---------- Original message ----------\nFrom: ${m.fromName} <${m.fromAddress}>\nDate: ${new Date(m.receivedAt).toLocaleString()}\nSubject: ${m.subject}\n\n${m.body}`
  }

  function handleReply() {
    if (!openMessage) return
    openCompose({
      accountId: openMessage.accountId,
      to: openMessage.fromAddress,
      subject: openMessage.subject.startsWith("Re:") ? openMessage.subject : `Re: ${openMessage.subject}`,
      body: quotePrefix(openMessage),
    })
  }

  function handleReplyAll() {
    if (!openMessage) return
    const cc = [openMessage.toAddresses, openMessage.ccAddresses].filter(Boolean).join(", ")
    openCompose({
      accountId: openMessage.accountId,
      to: openMessage.fromAddress,
      cc,
      subject: openMessage.subject.startsWith("Re:") ? openMessage.subject : `Re: ${openMessage.subject}`,
      body: quotePrefix(openMessage),
    })
  }

  function handleForward() {
    if (!openMessage) return
    openCompose({
      accountId: openMessage.accountId,
      subject: openMessage.subject.startsWith("Fwd:") ? openMessage.subject : `Fwd: ${openMessage.subject}`,
      body: quotePrefix(openMessage),
    })
  }

  function handleEditDraft() {
    if (!openMessage || openMessage.folderType !== "drafts") return
    openCompose({
      draftId: openMessage.id,
      accountId: openMessage.accountId,
      to: openMessage.toAddresses,
      cc: openMessage.ccAddresses,
      subject: openMessage.subject,
      body: openMessage.body,
      htmlBody: openMessage.htmlBody,
      fromAddress: openMessage.fromAddress,
      draftRevision: openMessage.draftRevision,
      draftShared: openMessage.draftShared,
      canManageDraftSharing: openMessage.canManageDraftSharing,
    })
  }

  async function handleArchive() {
    if (!openMessage) return
    await moveToFolder([openMessage.id], openMessage.folderType === "spam" ? "inbox" : "archive")
    setSelectedId(null)
    refreshAll()
  }

  async function handleDelete() {
    if (!openMessage) return
    if (selectedFolder === "trash") {
      await deleteForever([openMessage.id])
    } else {
      await moveToFolder([openMessage.id], "trash")
    }
    setSelectedId(null)
    refreshAll()
  }

  async function handleToggleStar() {
    if (!openMessage) return
    await toggleStarAction(openMessage.id, !openMessage.isStarred)
    mutateOpen()
    mutateMessages()
  }

  async function handleToggleFlag() {
    if (!openMessage) return
    await toggleFlagAction(openMessage.id, !openMessage.isFlagged)
    mutateOpen()
    mutateMessages()
  }

  async function handleToggleRead() {
    if (!openMessage) return
    await setRead(openMessage.id, !openMessage.isRead)
    mutateOpen()
    mutateMessages()
    mutateCounts()
  }

  async function handleSnooze(until: Date) {
    if (!openMessage) return
    await snoozeMessage(openMessage.id, until)
    setSelectedId(null)
    refreshAll()
  }

  async function handleUnsnooze() {
    if (!openMessage) return
    await unsnoozeMessage(openMessage.id)
    mutateOpen()
    refreshAll()
  }

  function handleShortcut(action: ShortcutAction) {
    switch (action.type) {
      case "navigate": {
        const idx = action.direction === "next"
          ? Math.min(focusedIndex + 1, messages.length - 1)
          : Math.max(focusedIndex - 1, 0)
        setFocusedIndex(idx)
        const m = messages[idx]
        if (m) handleSelectMessage(m)
        break
      }
      case "reply": handleReply(); break
      case "replyAll": handleReplyAll(); break
      case "forward": handleForward(); break
      case "archive": handleArchive(); break
      case "delete": handleDelete(); break
      case "star": handleToggleStar(); break
      case "toggleRead": handleToggleRead(); break
      case "focusSearch": searchRef.current?.focus(); break
      case "compose": openCompose(); break
      case "goToFolder":
        setSelectedFolder(action.folder)
        setSelectedCustomFolderId(null)
        setSelectedSmartFolder(null)
        setSelectedLabelId(null)
        setSelectedId(null)
        setSelectedIds(new Set())
        setMessagePageCount(1)
        setSidebarOpen(false)
        break
    }
  }

  useKeyboardShortcuts(handleShortcut, !addOpen && !composeOpen)
  useDesktopNotifications(messages)

  function handleOnboardingDone() {
    setShowOnboarding(false)
    refreshAll()
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <MailHeader
        userName={user.name}
        userEmail={user.email}
        onAddAccount={() => setAddOpen(true)}
        onManageAccounts={() => {
          if (accounts.length > 0) setEditAccount(accounts[0])
          else setAddOpen(true)
        }}
      />

      <div className="relative flex min-h-0 flex-1">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 z-20 bg-foreground/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar: slide-out drawer on mobile, inline on desktop */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 z-30 h-full w-64 overflow-x-hidden overflow-y-auto overscroll-y-contain [touch-action:pan-y] [-webkit-overflow-scrolling:touch] transition-transform md:static md:z-auto md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <MailSidebar
            accounts={accounts}
            counts={counts}
            selectedAccount={selectedAccount}
            selectedFolder={selectedFolder}
            onSelectAccount={(id) => {
              setSelectedAccount(id)
              setSelectedFolder("inbox")
              setSelectedCustomFolderId(null)
              setSelectedSmartFolder(null)
              setSelectedLabelId(null)
              setSelectedId(null)
              setSelectedIds(new Set())
              setFocusedIndex(0)
              setMessagePageCount(1)
              setSidebarOpen(false)
            }}
            onSelectFolder={(f) => {
              setSelectedLabelId(null)
              setSelectedSmartFolder(null)
              setSelectedFolder(f)
              setSelectedCustomFolderId(null)
              setSelectedId(null)
              setSelectedIds(new Set())
              setMessagePageCount(1)
              setSidebarOpen(false)
            }}
            onCompose={() => {
              openCompose()
              setSidebarOpen(false)
            }}
            onAddAccount={() => setAddOpen(true)}
            onRemoveAccount={(id) => setRemoveId(id)}
            onEditAccount={(id) => setEditAccount(accounts.find((a) => a.id === id) ?? null)}
            onSyncAccount={handleSyncAccount}
            syncingAccounts={syncingAccounts}
            customFolders={customFolders}
            planBadge={planBadge}
            selectedCustomFolderId={selectedCustomFolderId}
            selectedSmartFolder={selectedSmartFolder}
            onSelectSmartFolder={(type) => {
              setSelectedLabelId(null)
              setSelectedSmartFolder(type)
              setSelectedCustomFolderId(null)
              setSelectedFolder("inbox")
              setSelectedId(null)
              setSelectedIds(new Set())
              setMessagePageCount(1)
              setSidebarOpen(false)
            }}
            onSelectCustomFolder={handleSelectCustomFolder}
            onCreateFolder={() => setFolderDialogOpen(true)}
            onDeleteFolder={handleDeleteCustomFolder}
            labels={labels}
            selectedLabelId={selectedLabelId}
            onSelectLabel={(labelId) => {
              setSelectedLabelId(labelId)
              setSelectedSmartFolder(null)
              setSelectedCustomFolderId(null)
              setSelectedFolder("inbox")
              setSelectedId(null)
              setSidebarOpen(false)
            }}
            onCreateLabel={() => setLabelDialogOpen(true)}
            onDeleteLabel={async (labelId) => {
              await deleteLabel(labelId)
              if (selectedLabelId === labelId) setSelectedLabelId(null)
              await mutateLabels()
              refreshAll()
            }}
          />
        </div>

        {/* Message list: hidden on mobile when a message is open */}
        <div className={`min-h-0 min-w-0 flex-1 md:flex-none ${selectedId ? "hidden md:flex" : "flex"}`}>
          <MessageList
            messages={messages}
            hasMore={hasMoreMessages}
            loadingMore={isLoadingMore && messagePageCount > 1}
            onLoadMore={() => setMessagePageCount(messagePageCount + 1)}
            accounts={accounts}
            selectedFolder={selectedFolder}
            selectedId={selectedId}
            search={search}
            loading={isLoading}
            loadError={Boolean(messageError)}
            onSearch={setSearch}
            onSelect={handleSelectMessage}
            onToggleStar={handleToggleStarInList}
            onRefresh={refreshAll}
            onOpenMenu={() => setSidebarOpen(true)}
            searchRef={searchRef}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onBatchArchive={handleBatchArchive}
            onBatchDelete={handleBatchDelete}
            onBatchMarkRead={handleBatchMarkRead}
            onBatchStar={handleBatchStar}
            activeLabelName={labels.find((item) => item.id === selectedLabelId)?.name ?? ({ starred: "Starred", attachments: "With Attachments", unread: "Unread", snoozed: "Snoozed", assigned: "Assigned to me" }[selectedSmartFolder ?? ""])}
            labels={labels}
            onBatchToggleLabel={async (labelId, add) => {
              try {
                await toggleLabelOnMessages(Array.from(selectedIds), labelId, add)
                setSelectedIds(new Set())
                mutateMessages()
                toast.success(add ? "Label applied" : "Label removed")
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not update labels")
              }
            }}
          />
        </div>

        {/* Reading pane */}
        <div className={`min-h-0 min-w-0 flex-1 flex-col ${selectedId ? "flex" : "hidden md:flex"}`}>
          {selectedId && (
            <div className="flex items-center border-b border-border px-2 py-1 md:hidden">
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedId(null)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          )}
          <ReadingPane
            message={openMessage}
            accounts={accounts}
            onReply={handleReply}
            onReplyAll={handleReplyAll}
            onForward={handleForward}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onToggleStar={handleToggleStar}
            onToggleFlag={handleToggleFlag}
            onToggleRead={handleToggleRead}
            onSnooze={handleSnooze}
            onUnsnooze={handleUnsnooze}
            onEditDraft={handleEditDraft}
            labels={labels}
            onToggleLabel={async (labelId, add) => {
              if (!openMessage) return
              try {
                await toggleLabelOnMessage(openMessage.id, labelId, add)
                mutateOpen()
                mutateMessages()
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not update label")
              }
            }}
            onAssignmentChanged={() => { mutateOpen(); mutateMessages() }}
          />
        </div>
      </div>

      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} onAdded={refreshAll} />
      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        accounts={accounts}
        initial={composeInitial}
        onSent={refreshAll}
      />
      <EditAccountDialog
        account={editAccount}
        open={editAccount !== null}
        onOpenChange={(open) => { if (!open) setEditAccount(null) }}
        onSaved={refreshAll}
      />
      <CreateFolderDialog
        accountId={selectedAccount}
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        onCreated={refreshAll}
      />
      <CreateLabelDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        onCreated={() => mutateLabels()}
      />
      <RemoveAccountDialog
        accountId={removeId}
        accounts={accounts}
        onOpenChange={(open) => !open && setRemoveId(null)}
        onRemoved={() => {
          setSelectedId(null)
          setSelectedAccount("all")
          refreshAll()
        }}
      />

      {showOnboarding && accounts.length === 0 && (
        <OnboardingOverlay
          userName={user.name}
          onComplete={handleOnboardingDone}
          onSkip={handleOnboardingDone}
          onAccountAdded={refreshAll}
        />
      )}
    </div>
  )
}
