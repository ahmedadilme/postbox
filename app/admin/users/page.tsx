"use client"

import { useState } from "react"
import useSWR from "swr"
import { adminListUsers } from "@/app/actions/admin"
import { Input } from "@/components/ui/input"
import { Search, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function AdminUsersPage() {
  const [search, setSearch] = useState("")
  const { data: users = [], isLoading } = useSWR(["admin-users", search], () => adminListUsers(search), { keepPreviousData: true })

  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">Users</h1>
      <p className="mb-4 text-sm text-muted-foreground">All registered users across the platform. Click a name for details.</p>
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="h-9 pl-8" />
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
          <span className="col-span-4">Name</span>
          <span className="col-span-4">Email</span>
          <span className="col-span-2">Verified</span>
          <span className="col-span-2">Joined</span>
        </div>
        {isLoading ? <div className="p-4 text-sm text-muted-foreground">Loading...</div> : users.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No users found.</div> : users.map((u) => (
          <Link key={u.id} href={`/admin/users/${u.id}`} className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2.5 text-sm last:border-0 hover:bg-accent/50">
            <span className="col-span-4 truncate font-medium text-foreground">{u.name || "—"}</span>
            <span className="col-span-4 truncate text-muted-foreground">{u.email}</span>
            <span className="col-span-2">{u.emailVerified ? <span className="text-green-600">Yes</span> : <span className="text-muted-foreground">No</span>}</span>
            <span className="col-span-2 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
