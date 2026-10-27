"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { deleteAccount } from "@/app/actions/accounts"
import type { MailAccount } from "@/lib/mail/types"
import { getErrorMessage } from "@/lib/app-error"
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"

export function RemoveAccountDialog({
  accountId,
  accounts,
  onOpenChange,
  onRemoved,
}: {
  accountId: number | null
  accounts: MailAccount[]
  onOpenChange: (open: boolean) => void
  onRemoved: () => void
}) {
  const [loading, setLoading] = useState(false)
  const account = accounts.find((a) => a.id === accountId) ?? null

  async function handleRemove() {
    if (!account) return
    setLoading(true)
    try {
      await deleteAccount(account.id)
      toast.success(`Removed ${account.emailAddress}`)
      onRemoved()
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={accountId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove account</DialogTitle>
          <DialogDescription>
            {account ? (
              <>
                {"This removes "}
                <span className="font-medium text-foreground">{account.emailAddress}</span>
                {" and all of its locally stored messages from this dashboard. This cannot be undone."}
              </>
            ) : (
              "This account will be removed."
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remove account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
