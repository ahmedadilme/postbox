"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { message, messageAssignment, teamMember, user } from "@/lib/db/schema"
import { getUserAndTeam } from "@/lib/team"
import { recordMessageActivity } from "@/lib/mail/activity"
import { assertDraftsAccessible } from "@/lib/mail/draft-access"

export async function listTeamAssignees() {
  const { team } = await getUserAndTeam()
  return db.select({ id: user.id, name: user.name, email: user.email })
    .from(teamMember)
    .innerJoin(user, eq(user.id, teamMember.userId))
    .where(eq(teamMember.teamId, team.id))
    .orderBy(user.name)
}

export async function getMessageAssignment(messageId: number) {
  const { user: sessionUser, team } = await getUserAndTeam()
  await assertDraftsAccessible([messageId], team.id, sessionUser.id)
  const [assignment] = await db.select({ userId: user.id, name: user.name, email: user.email })
    .from(messageAssignment)
    .innerJoin(user, eq(user.id, messageAssignment.assignedTo))
    .where(and(eq(messageAssignment.teamId, team.id), eq(messageAssignment.messageId, messageId)))
    .limit(1)
  return assignment ?? null
}

export async function assignMessage(messageId: number, assignedToId: string | null) {
  const { user: actor, team } = await getUserAndTeam()
  if (!Number.isSafeInteger(messageId) || messageId < 1) throw new Error("Message not found")
  await assertDraftsAccessible([messageId], team.id, actor.id)
  const [ownedMessage] = await db.select({ id: message.id }).from(message)
    .where(and(eq(message.id, messageId), eq(message.teamId, team.id))).limit(1)
  if (!ownedMessage) throw new Error("Message not found")

  if (assignedToId === null) {
    const [previous] = await db.select({ userId: user.id, name: user.name }).from(messageAssignment)
      .innerJoin(user, eq(user.id, messageAssignment.assignedTo))
      .where(and(eq(messageAssignment.teamId, team.id), eq(messageAssignment.messageId, messageId))).limit(1)
    if (previous) {
      await db.delete(messageAssignment).where(and(eq(messageAssignment.teamId, team.id), eq(messageAssignment.messageId, messageId)))
      await recordMessageActivity({ teamId: team.id, messageId, actorId: actor.id, kind: "assignment", description: `removed ${previous.name}'s assignment` })
    }
  } else {
    const [member] = await db.select({ userId: teamMember.userId, name: user.name }).from(teamMember)
      .innerJoin(user, eq(user.id, teamMember.userId))
      .where(and(eq(teamMember.teamId, team.id), eq(teamMember.userId, assignedToId))).limit(1)
    if (!member) throw new Error("Choose a member of this team")
    const [previous] = await db.select({ userId: user.id, name: user.name }).from(messageAssignment)
      .innerJoin(user, eq(user.id, messageAssignment.assignedTo))
      .where(and(eq(messageAssignment.teamId, team.id), eq(messageAssignment.messageId, messageId))).limit(1)
    if (previous?.userId === assignedToId) return
    await db.insert(messageAssignment).values({
      teamId: team.id,
      messageId,
      assignedTo: assignedToId,
      assignedBy: actor.id,
    }).onConflictDoUpdate({
      target: messageAssignment.messageId,
      set: { teamId: team.id, assignedTo: assignedToId, assignedBy: actor.id, updatedAt: new Date() },
    })
    await recordMessageActivity({
      teamId: team.id,
      messageId,
      actorId: actor.id,
      kind: "assignment",
      description: previous ? `reassigned the message from ${previous.name} to ${member.name}` : `assigned the message to ${member.name}`,
    })
  }
  revalidatePath("/")
}
