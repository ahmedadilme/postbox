"use server"

import { and, asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { message, messageComment, teamMember, user } from "@/lib/db/schema"
import { getUserAndTeam } from "@/lib/team"
import { recordMessageActivity } from "@/lib/mail/activity"
import { assertDraftsAccessible } from "@/lib/mail/draft-access"

export interface MessageComment {
  id: number
  messageId: number
  userId: string
  authorName: string
  body: string
  createdAt: string
  updatedAt: string
  canDelete: boolean
}

async function ensureTeamMessage(messageId: number, teamId: string, userId: string) {
  const [owned] = await db.select({ id: message.id }).from(message)
    .where(and(eq(message.id, messageId), eq(message.teamId, teamId))).limit(1)
  if (!owned) throw new Error("Message not found")
  await assertDraftsAccessible([messageId], teamId, userId)
}

export async function listMessageComments(messageId: number): Promise<MessageComment[]> {
  const { user: sessionUser, team } = await getUserAndTeam()
  if (!Number.isSafeInteger(messageId) || messageId < 1) return []
  await ensureTeamMessage(messageId, team.id, sessionUser.id)
  const rows = await db.select({
    id: messageComment.id,
    messageId: messageComment.messageId,
    userId: messageComment.userId,
    authorName: user.name,
    body: messageComment.body,
    createdAt: messageComment.createdAt,
    updatedAt: messageComment.updatedAt,
  }).from(messageComment)
    .innerJoin(user, eq(messageComment.userId, user.id))
    .where(and(eq(messageComment.teamId, team.id), eq(messageComment.messageId, messageId)))
    .orderBy(asc(messageComment.createdAt), asc(messageComment.id))
  const [membership] = await db.select({ role: teamMember.role }).from(teamMember)
    .where(and(eq(teamMember.teamId, team.id), eq(teamMember.userId, sessionUser.id))).limit(1)
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    canDelete: row.userId === sessionUser.id || membership?.role === "admin",
  }))
}

export async function addMessageComment(messageId: number, body: string) {
  const { user: sessionUser, team } = await getUserAndTeam()
  if (!Number.isSafeInteger(messageId) || messageId < 1) throw new Error("Message not found")
  const normalizedBody = body.trim()
  if (!normalizedBody || normalizedBody.length > 5000) throw new Error("Comments must be 1–5,000 characters")
  await ensureTeamMessage(messageId, team.id, sessionUser.id)
  const [created] = await db.insert(messageComment).values({
    teamId: team.id,
    messageId,
    userId: sessionUser.id,
    body: normalizedBody,
  }).returning({ id: messageComment.id })
  await recordMessageActivity({ teamId: team.id, messageId, actorId: sessionUser.id, kind: "comment", description: "added an internal note" })
  revalidatePath("/")
  return { id: created.id }
}

export async function deleteMessageComment(commentId: number) {
  const { user: sessionUser, team } = await getUserAndTeam()
  if (!Number.isSafeInteger(commentId) || commentId < 1) return
  const [comment] = await db.select({ id: messageComment.id, messageId: messageComment.messageId, userId: messageComment.userId })
    .from(messageComment)
    .where(and(eq(messageComment.id, commentId), eq(messageComment.teamId, team.id)))
    .limit(1)
  if (!comment) return
  await assertDraftsAccessible([comment.messageId], team.id, sessionUser.id)
  const [membership] = await db.select({ role: teamMember.role }).from(teamMember)
    .where(and(eq(teamMember.teamId, team.id), eq(teamMember.userId, sessionUser.id))).limit(1)
  if (comment.userId !== sessionUser.id && membership?.role !== "admin") {
    throw new Error("You can only remove your own comments")
  }
  await recordMessageActivity({ teamId: team.id, messageId: comment.messageId, actorId: sessionUser.id, kind: "comment", description: "deleted an internal note" })
  await db.delete(messageComment).where(and(eq(messageComment.id, comment.id), eq(messageComment.teamId, team.id)))
  revalidatePath("/")
}
