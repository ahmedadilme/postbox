import "server-only"
import { randomUUID } from "node:crypto"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { team, teamMember } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { cookies, headers } from "next/headers"

export interface SessionUser {
  id: string
  name: string
  email: string
}

export async function getSessionUser(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return { id: session.user.id, name: session.user.name, email: session.user.email }
}

export async function getCurrentTeam(userId: string) {
  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value
  if (activeTeamId && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(activeTeamId)) {
    const [selected] = await db
      .select({ team })
      .from(teamMember)
      .innerJoin(team, eq(teamMember.teamId, team.id))
      .where(and(eq(teamMember.userId, userId), eq(team.id, activeTeamId)))
      .limit(1)
    if (selected) {
      if (selected.team.suspended) throw new Error(`Your account has been suspended. Reason: ${selected.team.suspensionReason ?? "No reason provided"}`)
      return selected.team
    }
  }

  const row = await db
    .select({ team: team })
    .from(teamMember)
    .innerJoin(team, eq(teamMember.teamId, team.id))
    .where(eq(teamMember.userId, userId))
    .limit(1)

  if (row.length === 0) {
    const defaultSlug = `team-${userId.slice(0, 8)}`
    return db.transaction(async (tx) => {
      // Serialize first-team creation for this slug so concurrent page loads
      // cannot both create it or claim an orphaned team row.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${defaultSlug}))`)

      const [membership] = await tx
        .select({ team })
        .from(teamMember)
        .innerJoin(team, eq(teamMember.teamId, team.id))
        .where(eq(teamMember.userId, userId))
        .limit(1)
      if (membership) {
        if (membership.team.suspended) {
          throw new Error(`Your account has been suspended. Reason: ${membership.team.suspensionReason ?? "No reason provided"}`)
        }
        return membership.team
      }

      const [existingTeam] = await tx.select().from(team).where(eq(team.slug, defaultSlug)).limit(1)
      let targetTeam: typeof existingTeam | undefined = existingTeam
      if (targetTeam) {
        const [existingMember] = await tx
          .select({ userId: teamMember.userId })
          .from(teamMember)
          .where(eq(teamMember.teamId, targetTeam.id))
          .limit(1)
        // Reuse the matching orphan left behind by a failed earlier request,
        // but never attach this user to a team that already has a member.
        if (existingMember) targetTeam = undefined
      }

      if (!targetTeam) {
        const [created] = await tx
          .insert(team)
          .values({ name: "My Team", slug: `team-${randomUUID()}` })
          .returning()
        targetTeam = created
      }

      if (targetTeam.suspended) {
        throw new Error(`Your account has been suspended. Reason: ${targetTeam.suspensionReason ?? "No reason provided"}`)
      }

      await tx.insert(teamMember).values({
        teamId: targetTeam.id,
        userId,
        role: "admin",
      })

      return targetTeam
    })
  }

  const t = row[0].team

  if (t.suspended) {
    const reason = t.suspensionReason ?? "No reason provided"
    throw new Error(`Your account has been suspended. Reason: ${reason}`)
  }

  return t
}

export async function getUserAndTeam() {
  const user = await getSessionUser()
  const t = await getCurrentTeam(user.id)
  return { user, team: t }
}
