import "server-only"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { team, teamMember } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
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
    const [created] = await db
      .insert(team)
      .values({ name: "My Team", slug: `team-${userId.slice(0, 8)}` })
      .returning()

    await db.insert(teamMember).values({
      teamId: created.id,
      userId,
      role: "admin",
    })

    return created
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
