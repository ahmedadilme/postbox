"use client"

import useSWR from "swr"
import { adminGetStats } from "@/app/actions/admin"
import { getPlan } from "@/lib/billing/plans"
import { Users, Building2, Mail, MessageSquare, ShieldAlert } from "lucide-react"
import Link from "next/link"

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useSWR("admin-stats", () => adminGetStats())

  if (isLoading || !stats) return <div className="text-sm text-muted-foreground">Loading...</div>

  const cards = [
    { label: "Users", value: stats.totalUsers, icon: Users, color: "text-blue-500" },
    { label: "Teams", value: stats.totalTeams, icon: Building2, color: "text-green-500" },
    { label: "Mail Accounts", value: stats.totalAccounts, icon: Mail, color: "text-purple-500" },
    { label: "Messages", value: stats.totalMessages, icon: MessageSquare, color: "text-amber-500" },
  ]

  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
      <p className="mb-6 text-sm text-muted-foreground">System-wide metrics and overview.</p>

      {/* Suspension alert */}
      {(stats.suspendedTeams ?? 0) > 0 && (
        <Link
          href="/admin/teams"
          className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive hover:bg-destructive/10"
        >
          <ShieldAlert className="h-4 w-4" />
          <span>{stats.suspendedTeams} team{(stats.suspendedTeams ?? 0) > 1 ? "s" : ""} currently suspended</span>
        </Link>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <c.icon className={`h-4 w-4 ${c.color}`} />
              {c.label}
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Plans</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.planBreakdown.map((p) => {
            const plan = getPlan(p.plan)
            return (
              <div key={p.plan} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground">{plan?.name ?? p.plan}</p>
                <p className="text-2xl font-bold text-foreground">{p.count}</p>
                <p className="text-xs text-muted-foreground">teams</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Latest users & teams */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Latest users</h2>
          <div className="rounded-xl border border-border bg-card">
            {stats.latestUsers.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-0 hover:bg-accent/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Latest teams</h2>
          <div className="rounded-xl border border-border bg-card">
            {stats.latestTeams.map((t) => (
              <Link key={t.id} href={`/admin/teams/${t.id}`} className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-0 hover:bg-accent/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{t.name}</span>
                  {t.suspended && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">Suspended</span>}
                </div>
                <span className="text-xs text-muted-foreground">{t.plan}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
