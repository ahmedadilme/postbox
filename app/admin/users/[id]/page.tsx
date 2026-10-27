"use client"

import { use } from "react"
import useSWR from "swr"
import { adminGetUserDetail } from "@/app/actions/admin"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: userDetail, isLoading } = useSWR(["user-detail", id], () => adminGetUserDetail(id))

  if (isLoading || !userDetail) return <div className="text-sm text-muted-foreground">Loading...</div>

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/admin/users" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">{userDetail.name || "Unnamed"}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Profile</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{userDetail.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verified</span>
              <span>{userDetail.emailVerified ? <span className="text-green-600">Yes</span> : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Joined</span>
              <span>{new Date(userDetail.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Teams */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Teams ({userDetail.teams.length})</h2>
          <div className="space-y-2">
            {userDetail.teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not a member of any team.</p>
            ) : (
              userDetail.teams.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/teams/${t.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-foreground">{t.name}</span>
                    {t.suspended && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">Suspended</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t.role}</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{t.plan}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Email Accounts */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Email Accounts ({userDetail.accounts.length})</h2>
        {userDetail.accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts connected.</p>
        ) : (
          <div className="space-y-1 text-sm">
            {userDetail.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1">
                <div>
                  <span className="text-foreground">{a.displayName}</span>
                  <span className="ml-2 text-muted-foreground">{a.emailAddress}</span>
                </div>
                <span className="text-xs text-muted-foreground">{a.syncStatus}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
