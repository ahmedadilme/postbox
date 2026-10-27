"use server"

import { db } from "@/lib/db"
import { mailAccount, team, teamMember } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getUserAndTeam } from "@/lib/team"
import { revalidatePath } from "next/cache"

export async function needsOnboarding() {
  const { user, team } = await getUserAndTeam()
  const accounts = await db
    .select({ id: mailAccount.id })
    .from(mailAccount)
    .where(and(eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id)))
    .limit(1)

  return accounts.length === 0
}

export async function getUserTeamInfo() {
  const { user, team } = await getUserAndTeam()

  const [member] = await db
    .select({ role: teamMember.role })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, team.id), eq(teamMember.userId, user.id)))
    .limit(1)

  const accounts = await db
    .select({ id: mailAccount.id })
    .from(mailAccount)
    .where(and(eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id)))
    .limit(1)

  return {
    team: { id: team.id, name: team.name, plan: team.plan },
    role: member?.role ?? "member",
    hasAccounts: accounts.length > 0,
  }
}

export async function completeOnboarding() {
  revalidatePath("/")
}
