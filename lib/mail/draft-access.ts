import { and, eq, inArray, ne } from "drizzle-orm"
import { db } from "@/lib/db"
import { message } from "@/lib/db/schema"

export async function assertDraftsAccessible(messageIds: number[], teamId: string, userId: string) {
  const ids = [...new Set(messageIds.filter((id) => Number.isSafeInteger(id) && id > 0))]
  if (!ids.length) return
  const [privateDraft] = await db.select({ id: message.id }).from(message)
    .where(and(
      eq(message.teamId, teamId),
      inArray(message.id, ids),
      eq(message.folderType, "drafts"),
      ne(message.userId, userId),
      eq(message.draftShared, false),
    )).limit(1)
  if (privateDraft) throw new Error("This draft is private")
}

export async function assertDraftsOwned(messageIds: number[], teamId: string, userId: string) {
  const ids = [...new Set(messageIds.filter((id) => Number.isSafeInteger(id) && id > 0))]
  if (!ids.length) return
  const [otherDraft] = await db.select({ id: message.id }).from(message)
    .where(and(
      eq(message.teamId, teamId),
      inArray(message.id, ids),
      eq(message.folderType, "drafts"),
      ne(message.userId, userId),
    )).limit(1)
  if (otherDraft) throw new Error("Only the draft owner can move or delete a shared draft")
}
