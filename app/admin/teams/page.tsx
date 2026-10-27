"use client"

import { useState } from "react"
import useSWR from "swr"
import { adminListTeams, adminSetTeamPlan, adminDeleteTeam } from "@/app/actions/admin"
import { Input } from "@/components/ui/input"
import { Search, Trash2, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { cn } from "@/lib/utils"

const PLANS = ["free", "pro", "team", "enterprise"]

export default function AdminTeamsPage() {
  const [search, setSearch] = useState("")
  const { data: teams = [], isLoading, mutate } = useSWR(["admin-teams", search], () => adminListTeams(search), { keepPreviousData: true })

  async function handleSetPlan(teamId: string, plan: string) {
    try { await adminSetTeamPlan(teamId, plan); toast.success(`Plan updated`); mutate() }
    catch { toast.error("Could not update plan") }
  }

  async function handleDelete(teamId: string) {
    if (!confirm("Delete this team and all its data? This cannot be undone.")) return
    try { await adminDeleteTeam(teamId); toast.success("Team deleted"); mutate() }
    catch { toast.error("Could not delete team") }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">Teams</h1>
      <p className="mb-4 text-sm text-muted-foreground">All teams on the platform. Click a team name for details and feature controls.</p>
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teams..." className="h-9 pl-8" />
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
          <span className="col-span-3">Name</span>
          <span className="col-span-2">Slug</span>
          <span className="col-span-1">Plan</span>
          <span className="col-span-1">Status</span>
          <span className="col-span-1">Members</span>
          <span className="col-span-2">Created</span>
          <span className="col-span-2">Actions</span>
        </div>
        {isLoading ? <div className="p-4 text-sm text-muted-foreground">Loading...</div> : teams.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No teams found.</div> : teams.map((t) => (
          <div key={t.id} className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2.5 text-sm last:border-0">
            <Link href={`/admin/teams/${t.id}`} className="col-span-3 truncate font-medium text-primary hover:underline">
              {t.name}
            </Link>
            <span className="col-span-2 truncate text-muted-foreground">{t.slug}</span>
            <span className="col-span-1">
              <select value={t.plan} onChange={(e) => handleSetPlan(t.id, e.target.value)} className="rounded border border-border bg-transparent px-1 py-0.5 text-sm">
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </span>
            <span className="col-span-1">
              {t.suspended ? (
                <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">Suspended</span>
              ) : (
                <span className="text-xs text-green-600">Active</span>
              )}
            </span>
            <span className="col-span-1 text-muted-foreground">{t.memberCount}</span>
            <span className="col-span-2 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
            <span className="col-span-2 flex items-center gap-2">
              <Link href={`/admin/teams/${t.id}`} className="text-muted-foreground hover:text-foreground" title="View details">
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <button onClick={() => handleDelete(t.id)} className="text-destructive hover:text-destructive/80" title="Delete team">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
