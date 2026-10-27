"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Plus, Star, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RichTextEditor } from "./rich-text-editor"
import {
  createSignature,
  deleteSignature,
  listSignatures,
  setDefaultSignature,
  updateSignature,
} from "@/app/actions/signatures"
import type { MailSignature } from "@/lib/mail/types"
import { toast } from "sonner"

export function SignatureManager({
  accountId,
  open,
  onOpenChange,
  onSaved,
}: {
  accountId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const [signatures, setSignatures] = useState<MailSignature[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const rows = await listSignatures(accountId)
    setSignatures(rows)
  }, [accountId])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    refresh().catch(() => toast.error("Could not load signatures")).finally(() => setLoading(false))
  }, [open, refresh])

  function startNew() {
    setEditingId(null)
    setName("")
    setBody("")
  }

  function startEditing(signature: MailSignature) {
    setEditingId(signature.id)
    setName(signature.name)
    setBody(signature.body)
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Enter a signature name")
      return
    }
    setLoading(true)
    try {
      if (editingId === null) {
        await createSignature(accountId, name, body)
      } else {
        await updateSignature(accountId, editingId, name, body)
      }
      await refresh()
      onSaved?.()
      toast.success(editingId === null ? "Signature added" : "Signature updated")
    } catch {
      toast.error("Could not save signature")
    } finally {
      setLoading(false)
    }
  }

  async function makeDefault(signatureId: number | null) {
    setLoading(true)
    try {
      await setDefaultSignature(accountId, signatureId)
      await refresh()
      onSaved?.()
    } catch {
      toast.error("Could not update the default signature")
    } finally {
      setLoading(false)
    }
  }

  async function remove(signature: MailSignature) {
    setLoading(true)
    try {
      await deleteSignature(accountId, signature.id)
      if (editingId === signature.id) startNew()
      await refresh()
      onSaved?.()
      toast.success("Signature deleted")
    } catch {
      toast.error("Could not delete signature")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Signatures</DialogTitle>
          <p className="text-sm text-muted-foreground">Create signatures for this account and choose which one to insert by default.</p>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="space-y-2" aria-label="Saved signatures">
            {signatures.length === 0 && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No signatures yet.</p>}
            {signatures.map((signature) => (
              <div key={signature.id} className="flex items-center gap-2 rounded-md border p-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => startEditing(signature)}>
                  <span className="block truncate text-sm font-medium">{signature.name}</span>
                  <span className="text-xs text-muted-foreground">{signature.isDefault ? "Default signature" : "Click to edit"}</span>
                </button>
                <Button
                  type="button"
                  variant={signature.isDefault ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label={signature.isDefault ? "Default signature" : `Set ${signature.name} as default`}
                  title={signature.isDefault ? "Default signature" : "Set as default"}
                  disabled={loading || signature.isDefault}
                  onClick={() => makeDefault(signature.id)}
                >
                  {signature.isDefault ? <Check className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${signature.name}`} disabled={loading} onClick={() => remove(signature)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {signatures.length > 0 && (
              <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => makeDefault(null)}>
                Clear default
              </Button>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{editingId === null ? "New signature" : "Edit signature"}</h3>
              <Button type="button" variant="outline" size="sm" onClick={startNew}>
                <Plus className="h-4 w-4" /> New
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signatureName">Name</Label>
              <Input id="signatureName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales team" />
            </div>
            <div className="space-y-2">
              <Label>Signature</Label>
              <RichTextEditor value={body} onChange={setBody} placeholder="Write your signature…" />
            </div>
            <Button type="button" onClick={save} disabled={loading || !name.trim()}>
              {editingId === null ? "Add signature" : "Save changes"}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
