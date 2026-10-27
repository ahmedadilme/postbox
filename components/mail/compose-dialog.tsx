"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { sendMessage, saveDraft, cancelQueuedMessage, deliverQueuedMessageForUser, getMessage } from "@/app/actions/messages"
import type { MailAccount } from "@/lib/mail/types"
import { getErrorMessage } from "@/lib/app-error"
import { toast } from "sonner"
import { Loader2, Send, Paperclip, X } from "lucide-react"
import { formatBytes } from "@/lib/mail/format"
import { RichTextEditor, sanitizeRichTextHtml } from "./rich-text-editor"

export interface ComposeInitial {
  draftId?: number
  accountId?: number
  to?: string
  cc?: string
  subject?: string
  body?: string
  htmlBody?: string | null
  fromAddress?: string
  draftRevision?: number
  draftShared?: boolean
  canManageDraftSharing?: boolean
}

interface AttachmentFile {
  file: File
  id: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\r?\n/g, "<br>")
}

function htmlToText(value: string) {
  const withLineBreaks = value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|blockquote|h[1-6]|tr)>/gi, "$&\n")
  const parsed = new DOMParser().parseFromString(withLineBreaks, "text/html")
  return (parsed.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim()
}

function replaceSignature(html: string, signatureId: number | null, signatureBody?: string) {
  const parsed = new DOMParser().parseFromString(sanitizeRichTextHtml(html), "text/html")
  parsed.body.querySelector("[data-account-signature]")?.remove()
  if (signatureId !== null && signatureBody) {
    const spacer = parsed.createElement("br")
    const secondSpacer = parsed.createElement("br")
    const block = parsed.createElement("div")
    block.dataset.accountSignature = "true"
    block.dataset.signatureId = String(signatureId)
    block.innerHTML = sanitizeRichTextHtml(signatureBody)
    parsed.body.append(spacer, secondSpacer, block)
  }
  return sanitizeRichTextHtml(parsed.body.innerHTML)
}

export function ComposeDialog({
  open,
  onOpenChange,
  accounts,
  initial,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: MailAccount[]
  initial?: ComposeInitial
  onSent: () => void
}) {
  const [accountId, setAccountId] = useState<number | undefined>(initial?.accountId ?? accounts[0]?.id)
  const [to, setTo] = useState(initial?.to ?? "")
  const [cc, setCc] = useState(initial?.cc ?? "")
  const [bcc, setBcc] = useState("")
  const [showBcc, setShowBcc] = useState(false)
  const [subject, setSubject] = useState(initial?.subject ?? "")
  const [body, setBody] = useState(initial?.body ?? "")
  const [bodyHtml, setBodyHtml] = useState("")
  const [signatureId, setSignatureId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftId, setDraftId] = useState<number | undefined>(initial?.draftId)
  const [draftRevision, setDraftRevision] = useState<number | undefined>(initial?.draftRevision)
  const [shareWithTeam, setShareWithTeam] = useState(initial?.draftShared ?? false)
  const [draftDirty, setDraftDirty] = useState(false)
  const [draftConflict, setDraftConflict] = useState(false)
  const discardConflictRef = useRef(false)
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedAccount = accounts.find((a) => a.id === accountId)

  function handleDraftError(error: unknown) {
    const message = getErrorMessage(error)
    if (message.toLowerCase().includes("changed in another window")) setDraftConflict(true)
    toast.error(message)
  }

  const persistDraft = useCallback(async () => {
    if (!accountId) return false
    if (bcc.trim() || attachments.length || /src=["']data:image\//i.test(bodyHtml)) {
      throw new Error("Save drafts after removing Bcc recipients, attachments, and inserted images. Those items are not stored in drafts yet.")
    }
    const result = await saveDraft({ draftId, expectedRevision: draftRevision, shareWithTeam, accountId, to, cc, subject, body, htmlBody: bodyHtml })
    setDraftId(result.draftId)
    setDraftRevision(result.draftRevision)
    setDraftDirty(false)
    onSent()
    return true
  }, [accountId, bcc, attachments.length, bodyHtml, draftId, draftRevision, shareWithTeam, to, cc, subject, body, onSent])

  useEffect(() => {
    if (open) {
      setDraftDirty(false)
      setAccountId(initial?.accountId ?? accounts[0]?.id)
      setDraftId(initial?.draftId)
      setDraftRevision(initial?.draftRevision)
      setShareWithTeam(initial?.draftShared ?? false)
      setDraftConflict(false)
      setTo(initial?.to ?? "")
      setCc(initial?.cc ?? "")
      setBcc("")
      setShowBcc(false)
      setSubject(initial?.subject ?? "")
      const nextAccountId = initial?.accountId ?? accounts[0]?.id
      const nextAccount = accounts.find((account) => account.id === nextAccountId)
      const defaultId = nextAccount?.defaultSignatureId ?? null
      const defaultSignature = nextAccount?.signatures.find((signature) => signature.id === defaultId)
      const initialHtml = initial?.htmlBody
        ? sanitizeRichTextHtml(initial.htmlBody)
        : escapeHtml(initial?.body ?? "")
      const nextHtml = initial?.draftId
        ? initialHtml
        : replaceSignature(initialHtml, defaultId, defaultSignature?.body)
      setSignatureId(initial?.draftId ? null : defaultId)
      setBodyHtml(nextHtml)
      setBody(htmlToText(nextHtml))
      setAttachments([])
    }
  }, [open, initial, accounts])

  useEffect(() => {
    if (!open || !draftDirty || !accountId || sending || savingDraft || draftConflict) return
    if (bcc.trim() || attachments.length || /src=["']data:image\//i.test(bodyHtml)) return

    const timer = setTimeout(async () => {
      setSavingDraft(true)
      try {
        await persistDraft()
        setDraftDirty(false)
      } catch (err) {
        setDraftDirty(false)
        handleDraftError(err)
      } finally {
        setSavingDraft(false)
      }
    }, 900)
    return () => clearTimeout(timer)
  }, [open, draftDirty, accountId, sending, savingDraft, draftConflict, bcc, attachments, bodyHtml, to, cc, subject, body, persistDraft])

  function handleAccountChange(value: string | null) {
    if (!value) return
    const nextAccountId = Number(value)
    const nextAccount = accounts.find((account) => account.id === nextAccountId)
    const defaultId = nextAccount?.defaultSignatureId ?? null
    const defaultSignature = nextAccount?.signatures.find((signature) => signature.id === defaultId)
    const nextHtml = replaceSignature(bodyHtml, defaultId, defaultSignature?.body)
    setAccountId(nextAccountId)
    setDraftDirty(true)
    setSignatureId(defaultId)
    setBodyHtml(nextHtml)
    setBody(htmlToText(nextHtml))
  }

  function handleSignatureChange(value: string | null) {
    const nextId = value && value !== "none" ? Number(value) : null
    const signature = selectedAccount?.signatures.find((item) => item.id === nextId)
    const nextHtml = replaceSignature(bodyHtml, nextId, signature?.body)
    setSignatureId(nextId)
    setDraftDirty(true)
    setBodyHtml(nextHtml)
    setBody(htmlToText(nextHtml))
  }

  function handleAttach() {
    fileInputRef.current?.click()
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({ file, id: crypto.randomUUID() })),
    ])
    e.target.value = ""
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen && discardConflictRef.current) {
      discardConflictRef.current = false
      onOpenChange(false)
      return
    }
    const hasContent = to.trim() || cc.trim() || bcc.trim() || subject.trim() || body.trim() || attachments.length
    if (!nextOpen && !sending && !savingDraft && accountId && hasContent) {
      setSavingDraft(true)
      try {
        await persistDraft()
      } catch (err) {
        handleDraftError(err)
        return
      } finally {
        setSavingDraft(false)
      }
    }
    onOpenChange(nextOpen)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accountId || !selectedAccount) {
      toast.error("Add an account first")
      return
    }
    if (draftConflict) return
    setSending(true)
    try {
      const formData = new FormData()
      formData.set("accountId", String(accountId))
      formData.set("to", to)
      formData.set("cc", cc)
      formData.set("bcc", bcc)
      formData.set("subject", subject)
      formData.set("body", body)
      formData.set("htmlBody", bodyHtml)
      if (draftId) {
        formData.set("draftId", String(draftId))
        if (draftRevision !== undefined) formData.set("draftRevision", String(draftRevision))
      }
      attachments.forEach(({ file }) => formData.append("attachments", file, file.name))
      const result = await sendMessage(formData)
      onOpenChange(false)
      onSent()
      const toastId = toast("Message will send in 5 seconds", {
        duration: 5_500,
        action: {
          label: "Undo",
          onClick: async () => {
            const cancellation = await cancelQueuedMessage(result.queuedId)
            if (cancellation.cancelled) {
              toast.dismiss(toastId)
              toast.success("Sending cancelled")
            } else {
              toast.error("The message has already started sending")
            }
          },
        },
      })
      window.setTimeout(async () => {
        try {
          const delivery = await deliverQueuedMessageForUser(result.queuedId)
          if (delivery.sent) toast.success("Message sent")
          else if (delivery.claimed) toast.error("Message could not be sent")
        } catch (error) {
          toast.error(getErrorMessage(error))
        }
      }, 5_000)
    } catch (err) {
      handleDraftError(err)
    } finally {
      setSending(false)
    }
  }

  async function handleSaveDraft() {
    if (!accountId) {
      toast.error("Add an account first")
      return
    }
    setSavingDraft(true)
    try {
      await persistDraft()
      toast.success("Draft saved")
    } catch (err) {
      handleDraftError(err)
    } finally {
      setSavingDraft(false)
    }
  }

  async function reloadLatestDraft() {
    if (!draftId) return
    try {
      const latest = await getMessage(draftId)
      if (!latest || latest.folderType !== "drafts") throw new Error("This draft is no longer available")
      setAccountId(latest.accountId)
      setTo(latest.toAddresses)
      setCc(latest.ccAddresses)
      setSubject(latest.subject)
      setBody(latest.body)
      setBodyHtml(latest.htmlBody ?? escapeHtml(latest.body))
      setDraftRevision(latest.draftRevision)
      setShareWithTeam(latest.draftShared ?? false)
      setDraftConflict(false)
      setDraftDirty(false)
      toast.success("Latest draft loaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reload draft")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draftId ? "Edit draft" : "New message"}</DialogTitle>
        </DialogHeader>

        {draftConflict && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <span>This draft was changed by someone else. Reload it before saving or sending.</span>
            <div className="flex shrink-0 gap-1">
              <Button type="button" size="sm" variant="outline" onClick={reloadLatestDraft}>Reload latest</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { discardConflictRef.current = true; void handleDialogOpenChange(false) }}>Discard my edits</Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Select value={accountId ? String(accountId) : ""} onValueChange={handleAccountChange} disabled={Boolean(initial?.draftId && initial.canManageDraftSharing === false)}>
              <SelectTrigger id="from">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.displayName} ({a.emailAddress})
                  </SelectItem>
                ))}
                {accountId && !accounts.some((a) => a.id === accountId) && (
                  <SelectItem value={String(accountId)}>Shared draft · {initial?.fromAddress ?? "original account"}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {initial?.draftId && initial.canManageDraftSharing === false && (
            <p className="-mt-2 text-[11px] text-muted-foreground">Only the draft owner can send this using the connected account.</p>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={shareWithTeam}
              disabled={Boolean(initial?.draftId && initial.canManageDraftSharing === false)}
              onChange={(event) => { setShareWithTeam(event.target.checked); setDraftDirty(true) }}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span>{initial?.draftId && initial.canManageDraftSharing === false ? "Shared with your team" : "Share this draft with my team"}</span>
          </label>
          <div className="flex items-center gap-2">
            <Label htmlFor="signature" className="w-12 shrink-0 text-xs text-muted-foreground">Signature</Label>
            <Select value={signatureId === null ? "none" : String(signatureId)} onValueChange={handleSignatureChange}>
              <SelectTrigger id="signature" className="h-8 max-w-xs">
                <SelectValue placeholder="No signature" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No signature</SelectItem>
                {selectedAccount?.signatures.map((signature) => (
                  <SelectItem key={signature.id} value={String(signature.id)}>
                    {signature.name}{signature.id === selectedAccount.defaultSignatureId ? " (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Label htmlFor="to" className="w-12 text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="to"
              value={to}
              onChange={(e) => { setTo(e.target.value); setDraftDirty(true) }}
              placeholder="recipient@example.com"
              required
              className="border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Label htmlFor="cc" className="w-12 text-xs text-muted-foreground">
              Cc
            </Label>
            <Input
              id="cc"
              value={cc}
              onChange={(e) => { setCc(e.target.value); setDraftDirty(true) }}
              placeholder="Optional"
              className="border-0 px-0 shadow-none focus-visible:ring-0"
            />
            <button
              type="button"
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowBcc(!showBcc)}
            >
              {showBcc ? "Hide" : "Bcc"}
            </button>
          </div>
          {showBcc && (
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Label htmlFor="bcc" className="w-12 text-xs text-muted-foreground">
                Bcc
              </Label>
              <Input
                id="bcc"
                value={bcc}
                onChange={(e) => { setBcc(e.target.value); setDraftDirty(true) }}
                placeholder="bcc@example.com"
                className="border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          )}
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Label htmlFor="subject" className="w-12 text-xs text-muted-foreground">
              Subject
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setDraftDirty(true) }}
              placeholder="Subject"
              className="border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <RichTextEditor
            value={bodyHtml}
            onChange={(html) => {
              setBodyHtml(html)
              setBody(htmlToText(html))
              setDraftDirty(true)
            }}
            placeholder="Write your message..."
            className="min-h-48 flex-1"
          />

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1"
                >
                  <span className="max-w-24 truncate text-xs">{att.file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(att.file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label="Attach file" title="Attachments" onClick={handleAttach}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
            </div>
            <Button type="button" variant="outline" disabled={sending || savingDraft} onClick={handleSaveDraft}>
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>
            <Button type="submit" disabled={sending || savingDraft || draftConflict || !selectedAccount}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
