"use server"

import { db } from "@/lib/db"
import { user, team, teamMember, mailAccount, message, auditLog } from "@/lib/db/schema"
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
  await db.update(team).set({ plan }).where(eq(team.id, teamId))
  await logAdminAction(admin.id, "change_plan", "team", teamId, { from: t?.plan, to: plan })
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
