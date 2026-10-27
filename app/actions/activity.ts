"use server"

import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { message, messageActivity, user as userTable } from "@/lib/db/schema"
import { getUserAndTeam } from "@/lib/team"
import { assertDraftsAccessible } from "@/lib/mail/draft-access"

export async function listMessageActivity(messageId: number) {
  const { user, team } = await getUserAndTeam()
  if (!Number.isSafeInteger(messageId) || messageId < 1) return []
  await assertDraftsAccessible([messageId], team.id, user.id)
  const [ownedMessage] = await db.select({ id: message.id }).from(message)
    .where(and(eq(message.id, messageId), eq(message.teamId, team.id))).limit(1)
  if (!ownedMessage) return []
  const rows = await db.select({
    id: messageActivity.id,
    kind: messageActivity.kind,
    description: messageActivity.description,
    actorName: userTable.name,
    createdAt: messageActivity.createdAt,
  }).from(messageActivity)
    .innerJoin(userTable, eq(userTable.id, messageActivity.actorId))
    .where(and(eq(messageActivity.teamId, team.id), eq(messageActivity.messageId, messageId)))
    .orderBy(desc(messageActivity.createdAt), desc(messageActivity.id))
    .limit(50)
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}
