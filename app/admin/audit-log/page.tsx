"use client"

import useSWR from "swr"
import { adminListAuditLog } from "@/app/actions/admin"

const ACTION_LABELS: Record<string, string> = {
  change_plan: "Changed plan",
  suspend_team: "Suspended team",
  unsuspend_team: "Unsuspended team",
  toggle_feature: "Toggled feature",
  clear_feature_override: "Cleared feature override",
  delete_team: "Deleted team",
}

export default function AuditLogPage() {
  const { data: logs = [], isLoading } = useSWR("audit-log", () => adminListAuditLog())

  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">Audit Log</h1>
      <p className="mb-4 text-sm text-muted-foreground">All admin actions across the platform.</p>

      <div className="rounded-xl border border-border bg-card">
        <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
          <span className="col-span-2">Admin</span>
          <span className="col-span-2">Action</span>
          <span className="col-span-2">Target</span>
          <span className="col-span-4">Details</span>
          <span className="col-span-2">Date</span>
        </div>
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No audit records yet.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2.5 text-sm last:border-0">
              <span className="col-span-2 truncate text-foreground">{log.adminEmail}</span>
              <span className="col-span-2 text-foreground">{ACTION_LABELS[log.action] ?? log.action}</span>
              <span className="col-span-2 text-muted-foreground">
                {log.targetType}:{log.targetId.slice(0, 8)}
              </span>
              <span className="col-span-4 truncate text-muted-foreground">
                {log.metadata ? JSON.stringify(log.metadata) : "—"}
              </span>
              <span className="col-span-2 text-muted-foreground">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
