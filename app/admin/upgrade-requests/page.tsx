"use client"

import { useState } from "react"
import useSWR from "swr"
import { adminListPlanUpgradeRequests, adminResolvePlanUpgradeRequest } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Check, Loader2, X } from "lucide-react"

export default function AdminUpgradeRequestsPage() {
  const { data: requests = [], isLoading, mutate } = useSWR("admin-plan-upgrade-requests", adminListPlanUpgradeRequests)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)

  async function resolve(requestId: string, decision: "approved" | "rejected") {
    setProcessing(requestId)
    try {
      await adminResolvePlanUpgradeRequest(requestId, decision, notes[requestId])
      toast.success(decision === "approved" ? "Plan request approved and plan activated" : "Plan request declined")
      await mutate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the request")
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-lg font-semibold text-foreground">Plan upgrade requests</h1>
      <p className="mb-5 text-sm text-muted-foreground">Review requests from team admins. Approval changes the tenant plan immediately; billing is handled manually.</p>

      <div className="space-y-3">
        {isLoading ? <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Loading requests…</p> : requests.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No plan requests yet.</p>
        ) : requests.map((request) => (
          <article key={request.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-medium text-foreground">{request.teamName}</h2>
                <p className="text-sm text-muted-foreground">{request.requesterName} · {request.requesterEmail}</p>
                <p className="mt-2 text-sm text-foreground">{request.currentPlan} → <span className="font-semibold capitalize">{request.requestedPlan}</span></p>
                {request.message && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{request.message}</p>}
                <p className="mt-2 text-xs text-muted-foreground">Requested {new Date(request.createdAt).toLocaleString()}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs capitalize ${request.status === "pending" ? "bg-amber-500/10 text-amber-700" : request.status === "approved" ? "bg-green-500/10 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {request.status}
              </span>
            </div>
            {request.status === "pending" && (
              <div className="mt-4 space-y-2 border-t border-border pt-3">
                <Textarea
                  value={notes[request.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                  placeholder="Optional note for the audit log"
                  maxLength={1000}
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => resolve(request.id, "rejected")} disabled={processing !== null}>
                    {processing === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Decline
                  </Button>
                  <Button onClick={() => resolve(request.id, "approved")} disabled={processing !== null}>
                    {processing === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Approve and activate
                  </Button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
