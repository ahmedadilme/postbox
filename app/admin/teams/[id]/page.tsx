"use client"

import { use } from "react"
import useSWR from "swr"
import { adminGetTeamDetail, adminSuspendTeam, adminUnsuspendTeam, adminSetFeatureOverride, adminClearFeatureOverride } from "@/app/actions/admin"
import { getPlan } from "@/lib/billing/plans"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const ALL_FEATURES = [
  "ai-summary", "ai-writing", "advanced-search", "smart-folders",
  "snooze", "signatures", "labels", "full-history",
  "shared-inbox", "internal-comments", "assignments", "shared-drafts",
  "activity-feed", "sso", "audit-logs", "data-retention",
]

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: raw, isLoading, mutate } = useSWR(["team-detail", id], () => adminGetTeamDetail(id))
  const [suspendReason, setSuspendReason] = useState("")

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>
  if (!raw) return <div className="text-sm text-muted-foreground">Team not found.</div>

  const teamDetail = raw
  const plan = getPlan(teamDetail.plan)

  async function handleSuspend() {
    if (!suspendReason.trim()) { toast.error("Enter a suspension reason"); return }
    try { await adminSuspendTeam(id, suspendReason.trim()); toast.success("Team suspended"); mutate() }
    catch { toast.error("Could not suspend") }
  }

  async function handleUnsuspend() {
    try { await adminUnsuspendTeam(id); toast.success("Team unsuspended"); mutate() }
    catch { toast.error("Could not unsuspend") }
  }

  async function handleToggleFeature(feature: string) {
    const current = teamDetail.featureOverrides[feature]
    const planDefault = plan.limits.features.includes(feature)
    if (feature in teamDetail.featureOverrides) {
      await adminClearFeatureOverride(id, feature)
    } else {
      await adminSetFeatureOverride(id, feature, !planDefault)
    }
    mutate()
  }

  function getFeatureState(feature: string): "on" | "off" | "overridden-on" | "overridden-off" {
    const planDefault = plan.limits.features.includes(feature)
    if (feature in teamDetail.featureOverrides) {
      return teamDetail.featureOverrides[feature] ? "overridden-on" : "overridden-off"
    }
    return planDefault ? "on" : "off"
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/admin/teams" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">{teamDetail.name}</h1>
        {teamDetail.suspended && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Suspended</span>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Slug</span><span>{teamDetail.slug}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium">{plan?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Members</span><span>{teamDetail.members.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Accounts</span><span>{teamDetail.accounts.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(teamDetail.createdAt).toLocaleDateString()}</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Access</h2>
          {teamDetail.suspended ? (
            <div className="space-y-3">
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                Suspended: {teamDetail.suspensionReason}
              </div>
              <Button variant="outline" className="gap-2" onClick={handleUnsuspend}>
                <ShieldCheck className="h-4 w-4" /> Unsuspend team
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason for suspension..." className="w-full rounded-md border border-border bg-transparent p-2 text-sm" rows={2} />
              <Button variant="destructive" className="gap-2" onClick={handleSuspend} disabled={!suspendReason.trim()}>
                <ShieldAlert className="h-4 w-4" /> Suspend team
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Members</h2>
          <div className="space-y-2">
            {teamDetail.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-foreground">{m.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{m.email}</span>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Feature Overrides</h2>
          <span className="text-xs text-muted-foreground">Plan: {plan?.name}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {ALL_FEATURES.map((feature) => {
            const state = getFeatureState(feature)
            return (
              <button key={feature} onClick={() => handleToggleFeature(feature)}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                  state === "on" || state === "overridden-on"
                    ? "border-green-500/30 bg-green-500/10 text-green-700"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
                title={feature in teamDetail.featureOverrides ? "Overridden — click to reset" : "Click to override"}
              >
                <span className="truncate">{feature}</span>
                <span className="ml-2 text-xs">
                  {state === "overridden-on" && "✓"}
                  {state === "overridden-off" && "✗"}
                  {state === "on" && "✓"}
                  {state === "off" && ""}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {teamDetail.accounts.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Email Accounts ({teamDetail.accounts.length})</h2>
          <div className="space-y-1 text-sm">
            {teamDetail.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1">
                <span>{a.emailAddress}</span>
                <span className="text-xs text-muted-foreground">{a.syncStatus}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
