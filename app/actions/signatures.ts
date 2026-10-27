"use server"

import { db } from "@/lib/db"
import { mailSignature, mailAccount } from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { getUserAndTeam } from "@/lib/team"
import { revalidatePath } from "next/cache"

async function getOwnedAccount(accountId: number) {
  const { user, team } = await getUserAndTeam()
  const [account] = await db
    .select({ id: mailAccount.id })
    .from(mailAccount)
    .where(and(eq(mailAccount.id, accountId), eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id)))
    .limit(1)
  if (!account) throw new Error("Account not found")
  return { user, team }
}

export async function listSignatures(accountId: number) {
  const { team } = await getOwnedAccount(accountId)
  return db.select().from(mailSignature).where(and(eq(mailSignature.teamId, team.id), eq(mailSignature.accountId, accountId)))
}

export async function createSignature(accountId: number, name: string, body: string) {
  const { user, team } = await getOwnedAccount(accountId)
  const [row] = await db.transaction(async (tx) => {
    const [account] = await tx
      .select({ defaultSignatureId: mailAccount.defaultSignatureId })
      .from(mailAccount)
      .where(and(eq(mailAccount.id, accountId), eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id)))
      .limit(1)
    const [created] = await tx
      .insert(mailSignature)
      .values({
        teamId: team.id,
        userId: user.id,
        accountId,
        name: name.trim(),
        body,
        isDefault: !account?.defaultSignatureId,
      })
      .returning()
    if (!account?.defaultSignatureId) {
      await tx.update(mailAccount).set({ defaultSignatureId: created.id }).where(eq(mailAccount.id, accountId))
    }
    return [created]
  })
  revalidatePath("/")
  return row
}

export async function updateSignature(accountId: number, id: number, name: string, body: string) {
  const { team } = await getOwnedAccount(accountId)
  await db
    .update(mailSignature)
    .set({ name: name.trim(), body, updatedAt: new Date() })
    .where(and(eq(mailSignature.id, id), eq(mailSignature.accountId, accountId), eq(mailSignature.teamId, team.id)))
  revalidatePath("/")
}

export async function deleteSignature(accountId: number, id: number) {
  const { user, team } = await getOwnedAccount(accountId)
  await db.transaction(async (tx) => {
    const [signature] = await tx
      .select({ id: mailSignature.id, isDefault: mailSignature.isDefault })
      .from(mailSignature)
      .where(and(eq(mailSignature.id, id), eq(mailSignature.accountId, accountId), eq(mailSignature.teamId, team.id)))
      .limit(1)
    if (!signature) return
    await tx.delete(mailSignature).where(eq(mailSignature.id, id))
    if (signature.isDefault) {
      const [nextDefault] = await tx
        .select({ id: mailSignature.id })
        .from(mailSignature)
        .where(and(eq(mailSignature.accountId, accountId), eq(mailSignature.teamId, team.id)))
        .orderBy(asc(mailSignature.id))
        .limit(1)
      if (nextDefault) {
        await tx.update(mailSignature).set({ isDefault: true }).where(eq(mailSignature.id, nextDefault.id))
      }
      await tx
        .update(mailAccount)
        .set({ defaultSignatureId: nextDefault?.id ?? null })
        .where(and(eq(mailAccount.id, accountId), eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id)))
    }
  })
  revalidatePath("/")
}

export async function setDefaultSignature(accountId: number, signatureId: number | null) {
  const { user, team } = await getOwnedAccount(accountId)
  if (signatureId !== null) {
    const [signature] = await db
      .select({ id: mailSignature.id })
      .from(mailSignature)
      .where(and(
        eq(mailSignature.id, signatureId),
        eq(mailSignature.accountId, accountId),
        eq(mailSignature.teamId, team.id),
      ))
      .limit(1)
    if (!signature) throw new Error("Signature not found")
  }
  await db.transaction(async (tx) => {
    await tx
      .update(mailSignature)
      .set({ isDefault: false })
      .where(and(eq(mailSignature.accountId, accountId), eq(mailSignature.teamId, team.id)))
    if (signatureId !== null) {
      await tx
        .update(mailSignature)
        .set({ isDefault: true })
        .where(and(eq(mailSignature.id, signatureId), eq(mailSignature.accountId, accountId), eq(mailSignature.teamId, team.id)))
    }
    await tx
      .update(mailAccount)
      .set({ defaultSignatureId: signatureId })
      .where(and(eq(mailAccount.id, accountId), eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id)))
  })
  revalidatePath("/")
}

