"use server"

import { db } from "@/lib/db"
import { user, team, teamMember, mailAccount, message, auditLog, planUpgradeRequest } from "@/lib/db/schema"
import { eq, sql, desc, count, and, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin, logAdminAction } from "@/lib/admin"
import { getPlan } from "@/lib/billing/plans"
import { PLANS } from "@/lib/billing/plans"

// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function adminGetStats() {
  const admin = await requireAdmin()

  const [userCount] = await db.select({ count: count() }).from(user)
  const [teamCount] = await db.select({ count: count() }).from(team)
  const [accountCount] = await db.select({ count: count() }).from(mailAccount)
  const [messageCount] = await db.select({ count: count() }).from(message)
  const [suspendedCount] = await db.select({ count: count() }).from(team).where(eq(team.suspended, true))

  const planBreakdown = await db
    .select({ plan: team.plan, count: count() })
    .from(team)
    .groupBy(team.plan)

  const latestUsers = await db.select().from(user).orderBy(desc(user.createdAt)).limit(5)
  const latestTeams = await db.select().from(team).orderBy(desc(team.createdAt)).limit(5)

  return {
    totalUsers: userCount.count,
    totalTeams: teamCount.count,
    totalAccounts: accountCount.count,
    totalMessages: messageCount.count,
    suspendedTeams: suspendedCount.count,
    planBreakdown,
    latestUsers: latestUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt.toISOString() })),
    latestTeams: latestTeams.map((t) => ({ id: t.id, name: t.name, plan: t.plan, suspended: t.suspended, createdAt: t.createdAt.toISOString() })),
  }
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function adminListUsers(search?: string) {
  await requireAdmin()
  const conds = [sql`1=1`]
  if (search?.trim()) {
    const q = `%${search.trim()}%`
    conds.push(sql`(email ILIKE ${q} OR name ILIKE ${q})`)
  }
  const rows = await db.select().from(user).where(sql.join(conds, sql` AND `)).orderBy(desc(user.createdAt)).limit(100)
  return rows.map((u) => ({
    id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified,
    createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString(),
  }))
}

export async function adminGetUserDetail(userId: string) {
  const admin = await requireAdmin()
  const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!u) throw new Error("User not found")

  const teams = await db
    .select({ id: team.id, name: team.name, plan: team.plan, suspended: team.suspended, role: teamMember.role })
    .from(teamMember)
    .innerJoin(team, eq(teamMember.teamId, team.id))
    .where(eq(teamMember.userId, userId))

  const accounts = await db
    .select({ id: mailAccount.id, emailAddress: mailAccount.emailAddress, displayName: mailAccount.displayName, syncStatus: mailAccount.syncStatus })
    .from(mailAccount)
    .where(eq(mailAccount.userId, userId))

  return {
    id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified,
    createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString(),
    teams, accounts,
  }
}

// ─── Teams ──────────────────────────────────────────────────────────────────

export async function adminListTeams(search?: string) {
  await requireAdmin()
  const conds = [sql`1=1`]
  if (search?.trim()) {
    const q = `%${search.trim()}%`
    conds.push(sql`(name ILIKE ${q} OR slug ILIKE ${q})`)
  }
  const rows = await db
    .select({
      id: team.id, name: team.name, slug: team.slug, plan: team.plan,
      suspended: team.suspended, createdAt: team.createdAt,
      memberCount: sql<number>`(SELECT count(*) FROM team_member WHERE team_member."teamId" = team.id)`,
    })
    .from(team)
    .where(sql.join(conds, sql` AND `))
    .orderBy(desc(team.createdAt))
    .limit(100)
  return rows.map((t) => ({
    id: t.id, name: t.name, slug: t.slug, plan: t.plan,
    suspended: t.suspended, memberCount: t.memberCount,
    createdAt: t.createdAt.toISOString(),
  }))
}

export async function adminGetTeamDetail(teamId: string) {
  const admin = await requireAdmin()
  const [t] = await db.select().from(team).where(eq(team.id, teamId)).limit(1)
  if (!t) throw new Error("Team not found")

  const members = await db
    .select({ id: teamMember.id, userId: teamMember.userId, role: teamMember.role, joinedAt: teamMember.joinedAt, name: user.name, email: user.email })
    .from(teamMember)
    .innerJoin(user, eq(teamMember.userId, user.id))
    .where(eq(teamMember.teamId, teamId))

  const accounts = await db
    .select({ id: mailAccount.id, emailAddress: mailAccount.emailAddress, displayName: mailAccount.displayName, syncStatus: mailAccount.syncStatus })
    .from(mailAccount)
    .where(eq(mailAccount.teamId, teamId))

  return {
    id: t.id, name: t.name, slug: t.slug, plan: t.plan,
    suspended: t.suspended, suspendedAt: t.suspendedAt?.toISOString() ?? null,
    suspensionReason: t.suspensionReason,
    featureOverrides: t.featureOverrides as Record<string, boolean>,
    createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    members, accounts,
  }
}

// ─── Plan ───────────────────────────────────────────────────────────────────

export async function adminSetTeamPlan(teamId: string, plan: string) {
  const admin = await requireAdmin()
  const [t] = await db.select({ plan: team.plan }).from(team).where(eq(team.id, teamId)).limit(1)
  if (!t) throw new Error("Team not found")
  if (!PLANS.some((availablePlan) => availablePlan.id === plan)) throw new Error("Unknown plan")
  await db.update(team).set({ plan }).where(eq(team.id, teamId))
  await logAdminAction(admin.id, "change_plan", "team", teamId, { from: t.plan, to: plan })
  revalidatePath("/admin")
}

export async function adminListPlanUpgradeRequests() {
  await requireAdmin()
  const rows = await db
    .select({
      id: planUpgradeRequest.id,
      teamId: planUpgradeRequest.teamId,
      teamName: team.name,
      currentPlan: team.plan,
      requestedPlan: planUpgradeRequest.requestedPlan,
      message: planUpgradeRequest.message,
      status: planUpgradeRequest.status,
      createdAt: planUpgradeRequest.createdAt,
      requesterName: user.name,
      requesterEmail: user.email,
    })
    .from(planUpgradeRequest)
    .innerJoin(team, eq(team.id, planUpgradeRequest.teamId))
    .innerJoin(user, eq(user.id, planUpgradeRequest.requestedBy))
    .orderBy(desc(planUpgradeRequest.createdAt))
    .limit(200)
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}

export async function adminResolvePlanUpgradeRequest(
  requestId: string,
  decision: "approved" | "rejected",
  adminNotes?: string,
) {
  const admin = await requireAdmin()
  if (decision !== "approved" && decision !== "rejected") throw new Error("Invalid review decision")
  if (adminNotes !== undefined && typeof adminNotes !== "string") throw new Error("Invalid admin notes")
  const notes = adminNotes?.trim() ?? ""
  if (notes.length > 1000) throw new Error("Admin notes must be 1,000 characters or fewer")

  const resolved = await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(planUpgradeRequest)
      .where(eq(planUpgradeRequest.id, requestId))
      .limit(1)
      .for("update")
    if (!request) throw new Error("Upgrade request not found")
    if (request.status !== "pending") throw new Error("This upgrade request has already been reviewed")

    const [targetTeam] = await tx
      .select({ plan: team.plan })
      .from(team)
      .where(eq(team.id, request.teamId))
      .limit(1)
      .for("update")
    if (!targetTeam) throw new Error("Team not found")

    if (decision === "approved") {
      if (!PLANS.some((availablePlan) => availablePlan.id === request.requestedPlan && (availablePlan.id === "pro" || availablePlan.id === "team"))) {
        throw new Error("The requested plan is no longer available")
      }
      await tx.update(team).set({ plan: request.requestedPlan, updatedAt: new Date() }).where(eq(team.id, request.teamId))
    }

    await tx.update(planUpgradeRequest).set({
      status: decision,
      reviewedBy: admin.id,
      adminNotes: notes || null,
      reviewedAt: new Date(),
    }).where(eq(planUpgradeRequest.id, request.id))

    return { teamId: request.teamId, fromPlan: targetTeam.plan, requestedPlan: request.requestedPlan }
  })

  await logAdminAction(admin.id, `plan_upgrade_${decision}`, "plan_upgrade_request", requestId, {
    teamId: resolved.teamId,
    fromPlan: resolved.fromPlan,
    requestedPlan: resolved.requestedPlan,
    notes: notes || null,
  })
  revalidatePath("/admin/upgrade-requests")
  revalidatePath("/admin/teams")
  revalidatePath("/admin")
}

// ─── Suspension ─────────────────────────────────────────────────────────────

export async function adminSuspendTeam(teamId: string, reason: string) {
  const admin = await requireAdmin()
  await db
    .update(team)
    .set({ suspended: true, suspendedAt: new Date(), suspensionReason: reason })
    .where(eq(team.id, teamId))
  await logAdminAction(admin.id, "suspend_team", "team", teamId, { reason })
  revalidatePath("/admin")
}

export async function adminUnsuspendTeam(teamId: string) {
  const admin = await requireAdmin()
  await db
    .update(team)
    .set({ suspended: false, suspendedAt: null, suspensionReason: null })
    .where(eq(team.id, teamId))
  await logAdminAction(admin.id, "unsuspend_team", "team", teamId, {})
  revalidatePath("/admin")
}

// ─── Feature Overrides ──────────────────────────────────────────────────────

export async function adminSetFeatureOverride(teamId: string, feature: string, enabled: boolean) {
  const admin = await requireAdmin()
  const [t] = await db.select({ featureOverrides: team.featureOverrides }).from(team).where(eq(team.id, teamId)).limit(1)
  const overrides = { ...(t?.featureOverrides as Record<string, boolean> ?? {}), [feature]: enabled }
  await db.update(team).set({ featureOverrides: overrides }).where(eq(team.id, teamId))
  await logAdminAction(admin.id, "toggle_feature", "team", teamId, { feature, enabled })
  revalidatePath("/admin")
}

export async function adminClearFeatureOverride(teamId: string, feature: string) {
  const admin = await requireAdmin()
  const [t] = await db.select({ featureOverrides: team.featureOverrides }).from(team).where(eq(team.id, teamId)).limit(1)
  const overrides = { ...(t?.featureOverrides as Record<string, boolean> ?? {}) }
  delete overrides[feature]
  await db.update(team).set({ featureOverrides: overrides }).where(eq(team.id, teamId))
  await logAdminAction(admin.id, "clear_feature_override", "team", teamId, { feature })
  revalidatePath("/admin")
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function adminDeleteTeam(teamId: string) {
  const admin = await requireAdmin()
  await logAdminAction(admin.id, "delete_team", "team", teamId, {})
  await db.delete(team).where(eq(team.id, teamId))
  revalidatePath("/admin")
}

// ─── Audit Log ──────────────────────────────────────────────────────────────

export async function adminListAuditLog() {
  await requireAdmin()
  const rows = await db
    .select({
      id: auditLog.id, action: auditLog.action, targetType: auditLog.targetType,
      targetId: auditLog.targetId, metadata: auditLog.metadata, createdAt: auditLog.createdAt,
      adminEmail: user.email, adminName: user.name,
    })
    .from(auditLog)
    .innerJoin(user, eq(auditLog.adminId, user.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(200)
  return rows.map((r) => ({
    id: r.id, action: r.action, targetType: r.targetType, targetId: r.targetId,
    metadata: r.metadata, adminEmail: r.adminEmail, adminName: r.adminName,
    createdAt: r.createdAt.toISOString(),
  }))
}
