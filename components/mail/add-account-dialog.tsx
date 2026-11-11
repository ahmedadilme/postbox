"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { addAccount, syncAccount, testAccountConnection, type AddAccountInput } from "@/app/actions/accounts"
import { getErrorMessage } from "@/lib/app-error"
import { toast } from "sonner"
import { Loader2, CheckCircle2, XCircle, ServerCog, ExternalLink } from "lucide-react"

const empty: AddAccountInput = {
  displayName: "",
  emailAddress: "",
  incomingProtocol: "imap",
  incomingHost: "",
  incomingPort: 993,
  incomingSecure: true,
  incomingUsername: "",
  incomingPassword: "",
  smtpHost: "",
  smtpPort: 465,
  smtpSecure: true,
  smtpUsername: "",
  smtpPassword: "",
}

export function AddAccountDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  const [form, setForm] = useState<AddAccountInput>(empty)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  function update<K extends keyof AddAccountInput>(key: K, value: AddAccountInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setTestResult(null)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testAccountConnection(form)
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, message: getErrorMessage(err) })
    } finally {
      setTesting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      // Validate hostnames before submitting
      const hostnameRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^(\d{1,3}\.){3}\d{1,3}$|^\[[0-9a-fA-F:]+\]$/
      if (!hostnameRegex.test(form.incomingHost)) {
        setSaving(false)
        toast.error("Invalid incoming server hostname")
        return
      }
      if (!hostnameRegex.test(form.smtpHost)) {
        setSaving(false)
        toast.error("Invalid outgoing server hostname")
        return
      }
      const accountEmail = form.emailAddress
      const { id } = await addAccount(form)
      toast.success(`${accountEmail} added`)
      setForm(empty)
      setTestResult(null)
      onOpenChange(false)
      onAdded()
      const syncToast = toast.loading(`Syncing ${accountEmail}…`)
      void syncAccount(id)
        .then(() => {
          toast.success(`${accountEmail} synced`, { id: syncToast })
          onAdded()
        })
        .catch((syncError) => {
          toast.error(`Account added, but initial sync failed: ${getErrorMessage(syncError)}`, { id: syncToast })
          onAdded()
        })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add mail account</DialogTitle>
          <DialogDescription>Enter your mail server settings. Postbox supports accounts that allow IMAP and SMTP access.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(e) => update("displayName", e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="emailAddress">Email address</Label>
              <Input
                id="emailAddress"
                type="email"
                value={form.emailAddress}
                onChange={(e) => update("emailAddress", e.target.value)}
                placeholder="jane@example.com"
                required
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ServerCog className="h-4 w-4 text-muted-foreground" />
              Incoming mail
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="incomingProtocol">Protocol</Label>
                <Select
                  value={form.incomingProtocol}
                  onValueChange={(v) => update("incomingProtocol", v as "imap" | "pop3")}
                >
                  <SelectTrigger id="incomingProtocol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imap">IMAP</SelectItem>
                    <SelectItem value="pop3" disabled>POP3 (not supported yet)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="incomingHost">Server host</Label>
                <Input
                  id="incomingHost"
                  value={form.incomingHost}
                  onChange={(e) => update("incomingHost", e.target.value)}
                  placeholder="imap.example.com"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="incomingPort">Port</Label>
                <Input
                  id="incomingPort"
                  type="number"
                  value={form.incomingPort}
                  onChange={(e) => update("incomingPort", Number(e.target.value))}
                  required
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 sm:col-span-2">
                <Label htmlFor="incomingSecure" className="cursor-pointer">
                  Use SSL/TLS
                </Label>
                <Switch
                  id="incomingSecure"
                  checked={form.incomingSecure}
                  onCheckedChange={(v) => update("incomingSecure", v)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="incomingUsername">Username</Label>
                <Input
                  id="incomingUsername"
                  value={form.incomingUsername}
                  onChange={(e) => update("incomingUsername", e.target.value)}
                  placeholder="jane@example.com"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="incomingPassword">Password</Label>
                <Input
                  id="incomingPassword"
                  type="password"
                  value={form.incomingPassword}
                  onChange={(e) => update("incomingPassword", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ServerCog className="h-4 w-4 text-muted-foreground" />
              Outgoing mail (SMTP)
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="smtpHost">Server host</Label>
                <Input
                  id="smtpHost"
                  value={form.smtpHost}
                  onChange={(e) => update("smtpHost", e.target.value)}
                  placeholder="smtp.example.com"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="smtpPort">Port</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={form.smtpPort}
                  onChange={(e) => update("smtpPort", Number(e.target.value))}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 sm:col-span-3">
                <Label htmlFor="smtpSecure" className="cursor-pointer">
                  Use SSL/TLS
                </Label>
                <Switch id="smtpSecure" checked={form.smtpSecure} onCheckedChange={(v) => update("smtpSecure", v)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="smtpUsername">Username</Label>
                <Input
                  id="smtpUsername"
                  value={form.smtpUsername}
                  onChange={(e) => update("smtpUsername", e.target.value)}
                  placeholder="jane@example.com"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="smtpPassword">Password</Label>
                <Input
                  id="smtpPassword"
                  type="password"
                  value={form.smtpPassword}
                  onChange={(e) => update("smtpPassword", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                testResult.ok
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
              role="status"
            >
              {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testResult.message}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
              {testing && <Loader2 className="h-4 w-4 animate-spin" />}
              Test connection
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
