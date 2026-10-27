"use client"

import { useState } from "react"
import useSWR from "swr"
import { getMemberRoleInfo, getMembers, getTeamAuditLog, updateTeam, inviteMember, removeMember } from "@/app/actions/team"
import { getAccounts } from "@/app/actions/accounts"
import { getPlan } from "@/lib/billing/plans"
import { can, type Role } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Mail, Settings, Users, CreditCard, ScrollText } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Tab = "general" | "members" | "billing" | "accounts" | "audit"

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general")
  const { data: roleInfo } = useSWR("role-info", () => getMemberRoleInfo())
  const { data: members = [], mutate: mutateMembers } = useSWR("members", () => getMembers())
  const { data: accounts = [] } = useSWR("accounts", () => getAccounts())
  const { data: auditLogs = [], isLoading: auditLogsLoading } = useSWR(roleInfo?.role === "admin" ? "team-audit-log" : null, () => getTeamAuditLog())

  const role = roleInfo?.role ?? "member"
  const team = roleInfo?.team
  const plan = team ? getPlan(team.plan) : null

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <Settings className="h-4 w-4" /> },
    { id: "members", label: "Members", icon: <Users className="h-4 w-4" /> },
    { id: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
    { id: "accounts", label: "Email Accounts", icon: <Mail className="h-4 w-4" /> },
    ...(roleInfo?.role === "admin" ? [{ id: "audit" as const, label: "Audit log", icon: <ScrollText className="h-4 w-4" /> }] : []),
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-12 items-center gap-3 border-b border-border px-4">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-sm font-semibold text-foreground">Settings</h1>
      </header>

      <div className="flex flex-1">
        {/* Sidebar tabs */}
        <nav className="hidden w-56 shrink-0 border-r border-border p-3 md:block">
          <div className="flex flex-col gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  tab === t.id
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "general" && <GeneralTab role={role} team={team} />}
          {tab === "members" && (
            <MembersTab role={role} members={members} team={team} mutateMembers={mutateMembers} />
          )}
          {tab === "billing" && <BillingTab team={team} plan={plan} />}
          {tab === "accounts" && <AccountsTab accounts={accounts} />}
          {tab === "audit" && role === "admin" && <AuditTab logs={auditLogs} loading={auditLogsLoading} />}
        </div>
      </div>
    </div>
  )
}

function AuditTab({ logs, loading }: { logs: Awaited<ReturnType<typeof getTeamAuditLog>>; loading: boolean }) {
  const labels: Record<string, string> = {
    invitation_created: "Created an invitation",
    invitation_accepted: "Joined the team",
    member_removed: "Removed a team member",
    account_added: "Added an email account",
    account_removed: "Removed an email account",
    draft_shared: "Shared a draft",
    draft_unshared: "Stopped sharing a draft",
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-lg font-semibold text-foreground">Team audit log</h2>
      <p className="mb-6 text-sm text-muted-foreground">Recent membership, account, and shared draft changes.</p>
      <div className="divide-y divide-border rounded-lg border border-border">
        {loading ? <p className="p-4 text-sm text-muted-foreground">Loading activity…</p> : logs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No team activity has been recorded yet.</p>
        ) : logs.map((log) => {
          const email = typeof log.metadata === "object" && log.metadata !== null && "emailAddress" in log.metadata
            ? String(log.metadata.emailAddress)
            : typeof log.metadata === "object" && log.metadata !== null && "email" in log.metadata
              ? String(log.metadata.email)
              : typeof log.metadata === "object" && log.metadata !== null && "name" in log.metadata
                ? String(log.metadata.name)
                : null
          return (
            <div key={log.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm text-foreground"><span className="font-medium">{log.actorName || log.actorEmail}</span> {labels[log.action] ?? log.action}{email ? `: ${email}` : ""}</p>
                <p className="text-xs text-muted-foreground">{log.actorEmail}</p>
              </div>
              <time className="text-xs text-muted-foreground" dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GeneralTab({ role, team }: { role: Role; team: { id: string; name: string; slug: string } | undefined }) {
  const [name, setName] = useState(team?.name ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateTeam({ name: name.trim() })
      toast.success("Team name updated")
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="text-lg font-semibold text-foreground">General</h2>
      <p className="mb-6 text-sm text-muted-foreground">Manage your team name and preferences.</p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="teamName">Team name</Label>
          <Input
            id="teamName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!can(role, "update-settings")}
          />
        </div>

        {team?.slug && (
          <div className="flex flex-col gap-2">
            <Label>Team slug</Label>
            <Input value={team.slug} disabled className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Used in URLs and API references.</p>
          </div>
        )}

        {can(role, "update-settings") && (
          <Button onClick={handleSave} disabled={saving} className="self-start">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        )}
      </div>
    </div>
  )
}

function MembersTab({
  role,
  members,
  team,
  mutateMembers,
}: {
  role: Role
  members: { id: number; userId: string; role: string; name: string; email: string }[]
  team: { id: string; name: string } | undefined
  mutateMembers: () => void
}) {
  const [inviteEmail, setInviteEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [inviteLink, setInviteLink] = useState("")

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setSending(true)
    try {
      const invitation = await inviteMember(inviteEmail.trim())
      setInviteLink(invitation.inviteUrl)
      try {
        await navigator.clipboard.writeText(invitation.inviteUrl)
        toast.success("Invite link copied. Share it with your teammate.")
      } catch {
        toast.success("Invite link created. Copy it below to share with your teammate.")
      }
      setInviteEmail("")
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send invitation")
    } finally {
      setSending(false)
    }
  }

  async function handleRemove(memberId: number) {
    try {
      await removeMember(memberId)
      mutateMembers()
      toast.success("Member removed")
    } catch {
      toast.error("Could not remove member")
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="text-lg font-semibold text-foreground">Members</h2>
      <p className="mb-6 text-sm text-muted-foreground">Manage who has access to this team.</p>

      {can(role, "invite-member") && (
        <div className="mb-6 space-y-2">
          <form onSubmit={handleInvite} className="flex gap-2">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1"
            />
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create invite
            </Button>
          </form>
          {inviteLink && (
            <div className="flex gap-2">
              <Input aria-label="Invitation link" value={inviteLink} readOnly />
              <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(inviteLink).then(
                () => toast.success("Invite link copied"),
                () => toast.error("Could not copy the invite link"),
              )}>
                Copy link
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Links expire after 7 days and can be shared with the invited email address only.</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{m.role}</span>
              {can(role, "remove-member") && m.role !== "admin" && (
                <button
                  onClick={() => handleRemove(m.id)}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BillingTab({
  team,
  plan,
}: {
  team: { id: string; plan: string; name: string } | undefined
  plan: { id: string; name: string; price: number } | null
}) {
  if (!team || !plan) return null

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="text-lg font-semibold text-foreground">Billing</h2>
      <p className="mb-6 text-sm text-muted-foreground">Manage your subscription and plan.</p>

      <p className="mb-6 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Paid plan checkout is not available yet. Your current plan remains active.
      </p>

      <Card className="mb-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Current plan</p>
            <p className="text-2xl font-bold text-foreground">{plan.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {plan.id === "free" ? "Free" : "No active subscription"}
            </p>
          </div>
        </div>
      </Card>

      {plan.id === "free" && (
        <p className="text-sm text-muted-foreground">
          Message history on the free plan is limited to 7 days. Paid plans are not available yet.
        </p>
      )}
    </div>
  )
}

function AccountsTab({ accounts }: { accounts: { id: number; emailAddress: string; displayName: string }[] }) {
  return (
    <div className="mx-auto max-w-lg">
      <h2 className="text-lg font-semibold text-foreground">Email Accounts</h2>
      <p className="mb-6 text-sm text-muted-foreground">Email accounts connected to this team.</p>

      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No accounts connected.{' '}
          <Link href="/" className="text-primary hover:underline">
            Add one from the dashboard
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{a.displayName}</p>
                <p className="text-xs text-muted-foreground">{a.emailAddress}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
