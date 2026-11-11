"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { requestPlanUpgrade } from "@/app/actions/upgrade-requests"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function PlanRequestButton({
  planId,
  signedIn,
  className,
  onRequested,
}: {
  planId: string
  signedIn: boolean
  className?: string
  onRequested?: (requestedPlan: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [requested, setRequested] = useState(false)

  if (!signedIn) {
    return (
      <Link
        href="/sign-up?redirectTo=%2Fpricing"
        className={className ?? "inline-flex h-10 w-full items-center justify-center rounded-md border border-border text-sm font-medium text-foreground hover:bg-accent"}
      >
        Create an account to request
      </Link>
    )
  }

  async function handleRequest() {
    setLoading(true)
    try {
      const result = await requestPlanUpgrade(planId)
      setRequested(true)
      onRequested?.(result.requestedPlan)
      toast.success(result.created ? "Upgrade request sent to the Postbox admin" : `Your ${result.requestedPlan} request is already pending`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send upgrade request")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button type="button" onClick={handleRequest} disabled={loading || requested} className={className}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {requested ? "Request sent" : "Request this plan"}
    </Button>
  )
}
