import "server-only"
import { db } from "@/lib/db"
import { teamAuditLog } from "@/lib/db/schema"

export async function recordTeamAuditLog(input: {
  teamId: string
  actorId: string
  action: string
  targetType: string
  targetId: string | number
  metadata?: Record<string, string | number | boolean | null>
}) {
  await db.insert(teamAuditLog).values({
    ...input,
    targetId: String(input.targetId),
    metadata: input.metadata ?? null,
  })
}
