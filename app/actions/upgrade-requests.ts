"use server"

import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { planUpgradeRequest, team, teamMember } from "@/lib/db/schema"
import { getUserAndTeam } from "@/lib/team"
import { PLANS } from "@/lib/billing/plans"
import { recordTeamAuditLog } from "@/lib/team/audit-log"
import { revalidatePath } from "next/cache"

export async function getMyPlanUpgradeRequest() {
  const { user, team: currentTeam } = await getUserAndTeam()
  const [request] = await db
    .select({ requestedPlan: planUpgradeRequest.requestedPlan, status: planUpgradeRequest.status, createdAt: planUpgradeRequest.createdAt })
    .from(planUpgradeRequest)
    .where(and(eq(planUpgradeRequest.teamId, currentTeam.id), eq(planUpgradeRequest.status, "pending")))
    .orderBy(desc(planUpgradeRequest.createdAt))
    .limit(1)

  return request ? { ...request, createdAt: request.createdAt.toISOString() } : null
}

export async function requestPlanUpgrade(planId: string, message?: string) {
  if (typeof planId !== "string") throw new Error("Choose an available paid plan")
  if (message !== undefined && typeof message !== "string") throw new Error("Invalid request message")
  const { user, team: currentTeam } = await getUserAndTeam()
  const [membership] = await db
    .select({ role: teamMember.role })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, currentTeam.id), eq(teamMember.userId, user.id)))
    .limit(1)

  if (membership?.role !== "admin") throw new Error("Only a team admin can request a plan change")
  const requestedPlan = PLANS.find((plan) => plan.id === planId && (plan.id === "pro" || plan.id === "team"))
  if (!requestedPlan) throw new Error("Choose an available paid plan")
  const rank: Record<string, number> = { free: 0, pro: 1, team: 2, enterprise: 3 }

  const trimmedMessage = message?.trim() ?? ""
  if (trimmedMessage.length > 1000) throw new Error("Please keep your message under 1,000 characters")

  const result = await db.transaction(async (tx) => {
    const [lockedTeam] = await tx
      .select({ id: team.id, plan: team.plan })
      .from(team)
      .where(eq(team.id, currentTeam.id))
      .limit(1)
      .for("update")
    if (!lockedTeam) throw new Error("Team not found")
    if ((rank[requestedPlan.id] ?? -1) <= (rank[lockedTeam.plan] ?? 0)) {
      throw new Error("Choose a plan above your team's current plan")
    }

    const [pending] = await tx
      .select({ requestedPlan: planUpgradeRequest.requestedPlan })
      .from(planUpgradeRequest)
      .where(and(eq(planUpgradeRequest.teamId, currentTeam.id), eq(planUpgradeRequest.status, "pending")))
      .limit(1)

    if (pending) return { created: false, requestedPlan: pending.requestedPlan, requestId: null }

    const [created] = await tx
      .insert(planUpgradeRequest)
      .values({
        teamId: currentTeam.id,
        requestedBy: user.id,
        requestedPlan: requestedPlan.id,
        message: trimmedMessage || null,
      })
      .returning({ id: planUpgradeRequest.id })

    return { created: true, requestedPlan: requestedPlan.id, requestId: created.id }
  })

  if (result.created && result.requestId) {
    await recordTeamAuditLog({
      teamId: currentTeam.id,
      actorId: user.id,
      action: "plan_upgrade_requested",
      targetType: "plan_upgrade_request",
      targetId: result.requestId,
      metadata: { requestedPlan: result.requestedPlan },
    })
    revalidatePath("/admin/upgrade-requests")
  }
  revalidatePath("/settings")
  return result
}
