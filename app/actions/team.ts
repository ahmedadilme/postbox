"use server"

import "server-only"
import { db } from "@/lib/db"
import { team, teamMember, invitation, user, teamAuditLog } from "@/lib/db/schema"
import { eq, and, isNull, gt, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getSessionUser, getCurrentTeam } from "@/lib/team"
import { can, type Role } from "@/lib/permissions"
import { getBillingGateway } from "@/lib/billing/gateway"
import { checkLimit } from "@/lib/billing/features"
import { PLANS } from "@/lib/billing/plans"
import type { PlanId } from "@/lib/billing/types"
import crypto from "node:crypto"
import { cookies } from "next/headers"
import { recordTeamAuditLog } from "@/lib/team/audit-log"

async function getMemberRole(teamId: string, userId: string): Promise<Role> {
  const [row] = await db
    .select({ role: teamMember.role })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)))
    .limit(1)
  return (row?.role as Role) ?? "member"
}

export async function getTeam() {
  const sessionUser = await getSessionUser()
  return getCurrentTeam(sessionUser.id)
}

export async function getMemberRoleInfo() {
  const sessionUser = await getSessionUser()
  const t = await getCurrentTeam(sessionUser.id)
  const role = await getMemberRole(t.id, sessionUser.id)
  return { role, team: t }
}

export async function getMembers() {
  const sessionUser = await getSessionUser()
  const t = await getCurrentTeam(sessionUser.id)
  return db
    .select({
      id: teamMember.id,
      userId: teamMember.userId,
      role: teamMember.role,
      joinedAt: teamMember.joinedAt,
      name: user.name,
      email: user.email,
    })
    .from(teamMember)
    .innerJoin(user, eq(teamMember.userId, user.id))
    .where(eq(teamMember.teamId, t.id))
}

export async function getTeamAuditLog() {
  const sessionUser = await getSessionUser()
  const t = await getCurrentTeam(sessionUser.id)
  const role = await getMemberRole(t.id, sessionUser.id)
  if (role !== "admin") throw new Error("Only team admins can view the audit log")

  const rows = await db
    .select({
      id: teamAuditLog.id,
      action: teamAuditLog.action,
      targetType: teamAuditLog.targetType,
      targetId: teamAuditLog.targetId,
      metadata: teamAuditLog.metadata,
      createdAt: teamAuditLog.createdAt,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(teamAuditLog)
    .innerJoin(user, eq(teamAuditLog.actorId, user.id))
    .where(eq(teamAuditLog.teamId, t.id))
    .orderBy(desc(teamAuditLog.createdAt))
    .limit(100)
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}

export async function updateTeam(data: { name?: string; slug?: string }) {
  const sessionUser = await getSessionUser()
  const t = await getCurrentTeam(sessionUser.id)
  const role = await getMemberRole(t.id, sessionUser.id)
  if (!can(role, "update-settings")) throw new Error("Only admins can update team settings")

  await db.update(team).set(data).where(eq(team.id, t.id))
  revalidatePath("/")
}

export async function inviteMember(email: string) {
  const sessionUser = await getSessionUser()
  const t = await getCurrentTeam(sessionUser.id)
  const role = await getMemberRole(t.id, sessionUser.id)
  if (!can(role, "invite-member")) throw new Error("Only admins can invite members")

  const normalizedEmail = email.trim().toLowerCase()
  if (normalizedEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address")
  }
  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) throw new Error("BETTER_AUTH_URL is not configured")

  const [existingMember] = await db
    .select({ id: teamMember.id })
    .from(teamMember)
    .innerJoin(user, eq(teamMember.userId, user.id))
    .where(and(eq(teamMember.teamId, t.id), eq(user.email, normalizedEmail)))
    .limit(1)
  if (existingMember) throw new Error("This person is already a team member")

  // Pending invitations count toward the member limit too.
  const members = await db
    .select({ count: teamMember.id })
    .from(teamMember)
    .where(eq(teamMember.teamId, t.id))
  const pending = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(and(eq(invitation.teamId, t.id), isNull(invitation.acceptedAt), gt(invitation.expiresAt, new Date())))
  const limit = checkLimit(t.plan, "maxMembers", members.length + pending.length)
  if (limit.remaining === "Limit reached") {
    throw new Error(`Member limit reached for the ${t.plan} plan. Upgrade to add more members.`)
  }

  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [existingInvite] = await db.select({ id: invitation.id }).from(invitation)
    .where(and(eq(invitation.teamId, t.id), eq(invitation.email, normalizedEmail), isNull(invitation.acceptedAt)))
    .limit(1)
  if (existingInvite) {
    await db.update(invitation).set({ token, expiresAt, createdAt: new Date() }).where(eq(invitation.id, existingInvite.id))
  } else {
    await db.insert(invitation).values({ teamId: t.id, email: normalizedEmail, token, expiresAt })
  }

  await recordTeamAuditLog({ teamId: t.id, actorId: sessionUser.id, action: "invitation_created", targetType: "invitation", targetId: normalizedEmail, metadata: { email: normalizedEmail } })

  revalidatePath("/")
  return { token, inviteUrl: new URL(`/invite/${token}`, baseUrl).toString(), expiresAt: expiresAt.toISOString() }
}

export async function acceptInvitation(token: string) {
  const sessionUser = await getSessionUser()
  if (!/^[\da-f]{64}$/i.test(token)) throw new Error("Invalid invitation")
  const accepted = await db.transaction(async (tx) => {
    const [invite] = await tx.select().from(invitation).where(eq(invitation.token, token)).limit(1).for("update")
    if (!invite) throw new Error("Invalid invitation")
    if (invite.acceptedAt) throw new Error("Invitation already accepted")
    if (invite.expiresAt < new Date()) throw new Error("Invitation expired")
    if (invite.email.toLowerCase() !== sessionUser.email.toLowerCase()) {
      throw new Error(`Sign in with ${invite.email} to accept this invitation`)
    }
    const [existingMembership] = await tx.select({ id: teamMember.id }).from(teamMember)
      .where(and(eq(teamMember.teamId, invite.teamId), eq(teamMember.userId, sessionUser.id))).limit(1)
    if (!existingMembership) {
      await tx.insert(teamMember).values({ teamId: invite.teamId, userId: sessionUser.id, role: invite.role })
    }
    await tx.update(invitation).set({ acceptedAt: new Date() }).where(eq(invitation.id, invite.id))
    return { teamId: invite.teamId }
  })
  await recordTeamAuditLog({ teamId: accepted.teamId, actorId: sessionUser.id, action: "invitation_accepted", targetType: "member", targetId: sessionUser.id })
  const cookieStore = await cookies()
  cookieStore.set("active_team_id", accepted.teamId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
  revalidatePath("/")
  return accepted
}

export async function removeMember(memberId: number) {
  const sessionUser = await getSessionUser()
  const t = await getCurrentTeam(sessionUser.id)
  const role = await getMemberRole(t.id, sessionUser.id)
  if (!can(role, "remove-member")) throw new Error("Only admins can remove members")

  const [member] = await db.select({ userId: teamMember.userId, name: user.name, email: user.email }).from(teamMember)
    .innerJoin(user, eq(teamMember.userId, user.id))
    .where(and(eq(teamMember.id, memberId), eq(teamMember.teamId, t.id))).limit(1)
  if (!member) throw new Error("Team member not found")
  if (member.userId === sessionUser.id) throw new Error("You cannot remove yourself from the team")
  await db.delete(teamMember).where(and(eq(teamMember.id, memberId), eq(teamMember.teamId, t.id)))
  await recordTeamAuditLog({ teamId: t.id, actorId: sessionUser.id, action: "member_removed", targetType: "member", targetId: member.userId, metadata: { name: member.name, email: member.email } })
  revalidatePath("/")
}

export async function changePlan(planId: string) {
  const sessionUser = await getSessionUser()
  const t = await getCurrentTeam(sessionUser.id)
  const role = await getMemberRole(t.id, sessionUser.id)
  if (!can(role, "manage-billing")) throw new Error("Only admins can change the plan")

  if (!PLANS.some((plan) => plan.id === planId)) throw new Error("Unknown plan")

  const gateway = getBillingGateway()
  if (gateway.name === "offline" && planId !== "free") {
    throw new Error("Paid plan checkout is not configured yet")
  }

  const result = await gateway.createCheckout(t.id, planId as PlanId, `${process.env.BETTER_AUTH_URL}/settings?upgraded=true`)
  return result
}
