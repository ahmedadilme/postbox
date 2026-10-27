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
          <DialogDescription>Connect an account using IMAP for incoming mail and SMTP for sending.</DialogDescription>
        </DialogHeader>

        {/* OAuth quick-connect buttons */}
        <div className="flex flex-col gap-2 mb-4">
          <button
            type="button"
            onClick={() => window.location.href = "/api/auth/google"}
            className="flex items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => window.location.href = "/api/auth/outlook"}
            className="flex items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#0078D4" d="M11.5 2v9.5H2V4.5L11.5 2zm0 11H2v7.5l9.5 2.5V13zm1 0V22L22 19.5V13H12.5zm0-11L22 4.5V11H12.5V2z"/></svg>
            Continue with Microsoft
          </button>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or enter details manually</span></div>
          </div>
        </div>

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
