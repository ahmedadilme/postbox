"use server"

import { db } from "@/lib/db"
import { label, message, messageLabel } from "@/lib/db/schema"
import { and, eq, ilike, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getUserAndTeam } from "@/lib/team"
import { assertDraftsAccessible } from "@/lib/mail/draft-access"

export interface LabelDef {
  id: number
  name: string
  color: string
}

export async function listLabels(): Promise<LabelDef[]> {
  const { user, team } = await getUserAndTeam()
  return db.select().from(label).where(eq(label.teamId, team.id)).orderBy(label.name)
}

export async function createLabel(name: string, color: string) {
  const { user, team } = await getUserAndTeam()
  const normalizedName = name.trim()
  if (!normalizedName || normalizedName.length > 64) throw new Error("Label names must be 1–64 characters")
  if (!/^#[\da-f]{6}$/i.test(color)) throw new Error("Choose a valid label color")
  const [existing] = await db.select({ id: label.id }).from(label)
    .where(and(eq(label.teamId, team.id), ilike(label.name, normalizedName))).limit(1)
  if (existing) throw new Error("A label with that name already exists")
  const [created] = await db.insert(label).values({ teamId: team.id, userId: user.id, name: normalizedName, color }).returning()
  revalidatePath("/")
  return { id: created.id }
}

export async function deleteLabel(labelId: number) {
  const { team } = await getUserAndTeam()
  const [ownedLabel] = await db
    .select({ id: label.id })
    .from(label)
    .where(and(eq(label.teamId, team.id), eq(label.id, labelId)))
    .limit(1)
  if (!ownedLabel) return

  await db.delete(messageLabel).where(eq(messageLabel.labelId, labelId))
  await db.delete(label).where(and(eq(label.teamId, team.id), eq(label.id, ownedLabel.id)))
  revalidatePath("/")
}

export async function toggleLabelOnMessage(messageId: number, labelId: number, add: boolean) {
  const { user, team } = await getUserAndTeam()
  await assertDraftsAccessible([messageId], team.id, user.id)
  const [ownedMessage] = await db
    .select({ id: message.id })
    .from(message)
    .where(and(eq(message.id, messageId), eq(message.teamId, team.id)))
    .limit(1)
  const [ownedLabel] = await db
    .select({ id: label.id })
    .from(label)
    .where(and(eq(label.id, labelId), eq(label.teamId, team.id)))
    .limit(1)
  if (!ownedMessage || !ownedLabel) return

  if (add) {
    const [existing] = await db
      .select()
      .from(messageLabel)
      .where(and(eq(messageLabel.messageId, messageId), eq(messageLabel.labelId, labelId)))
    if (!existing) {
      await db.insert(messageLabel).values({ messageId: ownedMessage.id, labelId: ownedLabel.id }).onConflictDoNothing()
    }
  } else {
    await db
      .delete(messageLabel)
      .where(and(eq(messageLabel.messageId, messageId), eq(messageLabel.labelId, labelId)))
  }
  revalidatePath("/")
}

export async function toggleLabelOnMessages(messageIds: number[], labelId: number, add: boolean) {
  const { user, team } = await getUserAndTeam()
  const ids = [...new Set(messageIds.filter((id) => Number.isSafeInteger(id) && id > 0))]
  if (!ids.length || ids.length > 100) throw new Error("Select between 1 and 100 messages")
  await assertDraftsAccessible(ids, team.id, user.id)
  if (!Number.isSafeInteger(labelId) || labelId < 1) throw new Error("Label not found")
  const [ownedLabel] = await db.select({ id: label.id }).from(label)
    .where(and(eq(label.id, labelId), eq(label.teamId, team.id))).limit(1)
  if (!ownedLabel) throw new Error("Label not found")
  const ownedMessages = await db.select({ id: message.id }).from(message)
    .where(and(eq(message.teamId, team.id), inArray(message.id, ids)))
  if (ownedMessages.length !== ids.length) throw new Error("One or more selected messages are unavailable")

  if (add) {
    const existing = await db.select({ messageId: messageLabel.messageId }).from(messageLabel)
      .where(and(eq(messageLabel.labelId, labelId), inArray(messageLabel.messageId, ids)))
    const existingIds = new Set(existing.map((item) => item.messageId))
    const additions = ids.filter((id) => !existingIds.has(id))
    if (additions.length) {
      await db.insert(messageLabel).values(additions.map((messageId) => ({ messageId, labelId }))).onConflictDoNothing()
    }
  } else {
    await db.delete(messageLabel).where(and(eq(messageLabel.labelId, labelId), inArray(messageLabel.messageId, ids)))
  }
  revalidatePath("/")
}

export async function getMessageLabels(messageId: number): Promise<LabelDef[]> {
  const { user, team } = await getUserAndTeam()
  await assertDraftsAccessible([messageId], team.id, user.id)
  return db
    .select({ id: label.id, name: label.name, color: label.color })
    .from(label)
    .innerJoin(messageLabel, eq(label.id, messageLabel.labelId))
    .innerJoin(message, eq(message.id, messageLabel.messageId))
    .where(and(eq(messageLabel.messageId, messageId), eq(message.teamId, team.id), eq(label.teamId, team.id)))
}
