"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { updateAccount } from "@/app/actions/accounts"
import type { MailAccount } from "@/lib/mail/types"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { SignatureManager } from "./signature-manager"

export function EditAccountDialog({
  account,
  open,
  onOpenChange,
  onSaved,
}: {
  account: MailAccount | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [displayName, setDisplayName] = useState("")
  const [saving, setSaving] = useState(false)
  const [signaturesOpen, setSignaturesOpen] = useState(false)

  useEffect(() => {
    if (account) {
      setDisplayName(account.displayName)
    }
  }, [account])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!account) return
    setSaving(true)
    try {
      await updateAccount(account.id, { displayName })
      toast.success("Account updated")
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error("Could not update account")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {account?.emailAddress}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="editDisplayName">Display name</Label>
              <Input
                id="editDisplayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Email</Label>
              <Input value={account?.emailAddress ?? ""} disabled className="text-muted-foreground" />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Signatures</p>
              <p className="text-xs text-muted-foreground">Create multiple rich-text signatures, choose a default, and switch while composing.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setSignaturesOpen(true)} disabled={!account}>
              Manage signatures
            </Button>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {account && (
      <SignatureManager
        accountId={account.id}
        open={signaturesOpen}
        onOpenChange={setSignaturesOpen}
        onSaved={onSaved}
      />
    )}
    </>
  )
}
