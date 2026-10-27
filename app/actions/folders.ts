"use server"

import { db } from "@/lib/db"
import { folder } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getUserAndTeam } from "@/lib/team"

export interface CustomFolder {
  id: number
  teamId: string
  userId: string
  accountId: number
  name: string
  sortOrder: number
}

export async function listFolders(accountId?: number): Promise<CustomFolder[]> {
  const { user, team } = await getUserAndTeam()
  const conds = [eq(folder.teamId, team.id)]
  if (accountId) conds.push(eq(folder.accountId, accountId))
  const rows = await db.select().from(folder).where(and(...conds)).orderBy(folder.sortOrder)
  return rows.map((r) => ({ id: r.id, teamId: r.teamId, userId: r.userId, accountId: r.accountId, name: r.name, sortOrder: r.sortOrder }))
}

export async function createFolder(accountId: number, name: string) {
  const { user, team } = await getUserAndTeam()
  const [created] = await db
    .insert(folder)
    .values({ teamId: team.id, userId: user.id, accountId, name, type: "custom", sortOrder: 0 })
    .returning()
  revalidatePath("/")
  return { id: created.id }
}

export async function renameFolder(folderId: number, name: string) {
  const { user, team } = await getUserAndTeam()
  await db
    .update(folder)
    .set({ name })
    .where(and(eq(folder.teamId, team.id), eq(folder.id, folderId)))
  revalidatePath("/")
}

export async function deleteFolder(folderId: number) {
  const { user, team } = await getUserAndTeam()
  await db.delete(folder).where(and(eq(folder.teamId, team.id), eq(folder.id, folderId)))
  revalidatePath("/")
}
