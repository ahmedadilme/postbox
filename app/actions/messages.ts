"use server"

import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import { message, attachment, mailAccount, outgoingQueue, label, messageLabel, messageAssignment, user as userTable } from "@/lib/db/schema"
import { and, eq, desc, sql, inArray, or, ilike, isNotNull, lte, lt, gte, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { updateImapMessages } from "@/lib/mail/provider"
import type { ImapCredentials, ImapMessageOperation, ImapMessageOperationResult } from "@/lib/mail/provider"
import { decrypt } from "@/lib/encryption"
import { getValidAccessToken } from "@/lib/oauth/refresh"
import { deliverQueuedMessage, type QueuedMailPayload } from "@/lib/mail/outbox"
import { getUserAndTeam } from "@/lib/team"
import { AppError } from "@/lib/app-error"
import { assertDraftsAccessible, assertDraftsOwned } from "@/lib/mail/draft-access"
import { looksLikeRawEmail, parseMessageContent, sanitizeEmailHtml } from "@/lib/mail/message-content"
import { recordTeamAuditLog } from "@/lib/team/audit-log"
import type { MailMessage, FolderType, FolderCount } from "@/lib/mail/types"

type MutationRow = {
  id: number
  accountId: number
  messageUid: number | null
  folderPath: string | null
  incomingHost: string
  incomingPort: number
  incomingSecure: boolean
  incomingUsername: string
  incomingPassword: string
  authType: string
}

type MutationOutcome = ImapMessageOperationResult & { messageId: number; messageUid?: number | null }

async function loadMutationRows(ids: number[], teamId: string, userId: string): Promise<MutationRow[]> {
  if (!ids.length) return []
  return db
    .select({
      id: message.id,
      accountId: mailAccount.id,
      messageUid: message.messageUid,
      folderPath: message.folderPath,
      incomingHost: mailAccount.incomingHost,
      incomingPort: mailAccount.incomingPort,
      incomingSecure: mailAccount.incomingSecure,
      incomingUsername: mailAccount.incomingUsername,
      incomingPassword: mailAccount.incomingPassword,
      authType: mailAccount.authType,
    })
    .from(message)
    .innerJoin(mailAccount, eq(message.accountId, mailAccount.id))
    .where(and(
      eq(message.teamId, teamId),
      eq(mailAccount.teamId, teamId),
      inArray(message.id, ids),
      or(ne(message.folderType, "drafts"), eq(message.userId, userId), eq(message.draftShared, true)),
    ))
}

async function applyImapOperation(
  rows: MutationRow[],
  operation: ImapMessageOperation,
): Promise<{ outcomes: MutationOutcome[]; errors: Error[] }> {
  const groups = new Map<string, MutationRow[]>()
  for (const row of rows) {
    if (!row.folderPath || row.messageUid == null) continue
    const key = `${row.accountId}\u0000${row.folderPath}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const outcomes: MutationOutcome[] = []
  const errors: Error[] = []
  for (const group of groups.values()) {
    const account = group[0]
    try {
      const accessToken = account.authType === "oauth" ? await getValidAccessToken(account.accountId) : undefined
      const credentials: ImapCredentials = {
        host: account.incomingHost,
        port: account.incomingPort,
        secure: account.incomingSecure,
        username: account.incomingUsername,
        password: account.authType === "oauth" ? "" : decrypt(account.incomingPassword),
        accessToken,
      }
      const result = await updateImapMessages(
        credentials,
        account.folderPath!,
        group.map((row) => row.messageUid!),
        operation,
      )
      for (const row of group) {
        const nextUid = result.uidMap?.get(row.messageUid!)
        outcomes.push({
          ...result,
          messageId: row.id,
          messageUid: operation.type === "move"
            ? result.destinationPath === row.folderPath
              ? row.messageUid
              : nextUid ?? null
            : undefined,
        })
      }
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error("IMAP operation failed"))
    }
  }
  return { outcomes, errors }
}

function idsSafeToUpdate(rows: MutationRow[], outcomes: MutationOutcome[]) {
  const completed = new Set(outcomes.map((outcome) => outcome.messageId))
  return rows
    .filter((row) => !row.folderPath || row.messageUid == null || completed.has(row.id))
    .map((row) => row.id)
}

function toMail(r: typeof message.$inferSelect): MailMessage {
  return {
    id: r.id,
    accountId: r.accountId,
    folderType: r.folderType as FolderType,
    fromName: r.fromName,
    fromAddress: r.fromAddress,
    toAddresses: r.toAddresses,
    ccAddresses: r.ccAddresses,
    subject: r.subject,
    preview: r.preview,
    body: r.body,
    htmlBody: r.htmlBody,
    isRead: r.isRead,
    isStarred: r.isStarred,
    isFlagged: r.isFlagged,
    hasAttachments: r.hasAttachments,
    snoozedUntil: r.snoozedUntil?.toISOString() ?? null,
    draftShared: r.draftShared,
    draftRevision: r.draftRevision,
    draftOwnerId: r.userId,
    receivedAt: r.receivedAt.toISOString(),
  }
}

export async function listMessages(opts: {
  accountId: number | "all"
  folderType: FolderType
  smartFolder?: string
  search?: string
  cursor?: { receivedAt: string; id: number } | null
  limit?: number
  labelId?: number | null
}): Promise<{ messages: MailMessage[]; nextCursor: { receivedAt: string; id: number } | null }> {
  const { user, team } = await getUserAndTeam()
  const conds = [eq(message.teamId, team.id)]
  // Private drafts are only visible to their creator; shared drafts are available to the whole team.
  conds.push(or(ne(message.folderType, "drafts"), eq(message.userId, user.id), eq(message.draftShared, true))!)

  // Auto-unsnooze any overdue messages
  await db
    .update(message)
    .set({ snoozedUntil: null, folderType: "inbox" })
    .where(and(eq(message.teamId, team.id), lte(message.snoozedUntil, new Date())))

  if (opts.smartFolder) {
    // Snoozed messages have their own folder type while the timer is active;
    // other smart folders are scoped to Inbox.
    if (opts.smartFolder === "snoozed") conds.push(eq(message.folderType, "snoozed"))
    else if (opts.smartFolder !== "assigned") conds.push(eq(message.folderType, "inbox"))
    switch (opts.smartFolder) {
      case "starred":
        conds.push(eq(message.isStarred, true))
        break
      case "attachments":
        conds.push(eq(message.hasAttachments, true))
        break
      case "unread":
        conds.push(eq(message.isRead, false))
        break
      case "snoozed":
        conds.push(isNotNull(message.snoozedUntil))
        break
      case "assigned":
        conds.push(inArray(message.id, db.select({ messageId: messageAssignment.messageId }).from(messageAssignment)
          .where(and(eq(messageAssignment.teamId, team.id), eq(messageAssignment.assignedTo, user.id)))))
        break
    }
  } else {
    conds.push(eq(message.folderType, opts.folderType))
  }

  if (opts.accountId !== "all") conds.push(eq(message.accountId, opts.accountId))
  if (opts.labelId) {
    const [ownedLabel] = await db.select({ id: label.id }).from(label)
      .where(and(eq(label.id, opts.labelId), eq(label.teamId, team.id))).limit(1)
    if (!ownedLabel) return { messages: [], nextCursor: null }
    conds.push(inArray(message.id, db.select({ messageId: messageLabel.messageId }).from(messageLabel)
      .where(eq(messageLabel.labelId, ownedLabel.id))))
  }
  if (opts.cursor) {
    const cursorDate = new Date(opts.cursor.receivedAt)
    if (Number.isFinite(cursorDate.getTime()) && Number.isSafeInteger(opts.cursor.id) && opts.cursor.id > 0) {
      conds.push(or(
        lt(message.receivedAt, cursorDate),
        and(eq(message.receivedAt, cursorDate), lt(message.id, opts.cursor.id)),
      )!)
    }
  }
  if (opts.search && opts.search.trim()) {
    const textTerms: string[] = []
    const tokenPattern = /(?:([a-z]+):)?(?:"([^"]+)"|'([^']+)'|(\S+))/gi
    for (const match of opts.search.matchAll(tokenPattern)) {
      const key = match[1]?.toLowerCase()
      const value = (match[2] ?? match[3] ?? match[4] ?? "").trim()
      if (!value) continue
      if (!key) {
        textTerms.push(value)
        continue
      }
      const likeValue = "%" + value + "%"
      switch (key) {
        case "from": conds.push(ilike(message.fromAddress, likeValue)); break
        case "to": conds.push(ilike(message.toAddresses, likeValue)); break
        case "cc": conds.push(ilike(message.ccAddresses, likeValue)); break
        case "subject": conds.push(ilike(message.subject, likeValue)); break
        case "has":
          if (value.toLowerCase() === "attachment") conds.push(eq(message.hasAttachments, true))
          else textTerms.push(key + ":" + value)
          break
        case "is":
          if (value.toLowerCase() === "unread") conds.push(eq(message.isRead, false))
          else if (value.toLowerCase() === "read") conds.push(eq(message.isRead, true))
          else if (value.toLowerCase() === "starred") conds.push(eq(message.isStarred, true))
          else if (value.toLowerCase() === "flagged") conds.push(eq(message.isFlagged, true))
          else textTerms.push(key + ":" + value)
          break
        case "before":
        case "after": {
          const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00.000Z") : null
          if (date && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value) {
            conds.push(key === "before" ? lt(message.receivedAt, date) : gte(message.receivedAt, date))
          } else {
            textTerms.push(key + ":" + value)
          }
          break
        }
        default: textTerms.push(key + ":" + value)
      }
    }

    // Quoted values stay together; each unquoted word is an additional filter.
    for (const term of textTerms) {
      const likeTerm = "%" + term + "%"
      conds.push(or(
        ilike(message.subject, likeTerm),
        ilike(message.fromName, likeTerm),
        ilike(message.fromAddress, likeTerm),
        ilike(message.toAddresses, likeTerm),
        ilike(message.ccAddresses, likeTerm),
        ilike(message.preview, likeTerm),
        ilike(message.body, likeTerm),
      )!)
    }
  }
  const pageSize = Math.min(Math.max(opts.limit ?? 50, 1), 100)
  const rows = await db
    .select({
      id: message.id,
      accountId: message.accountId,
      folderType: message.folderType,
      fromName: message.fromName,
      fromAddress: message.fromAddress,
      toAddresses: message.toAddresses,
      ccAddresses: message.ccAddresses,
      subject: message.subject,
      preview: message.preview,
      isRead: message.isRead,
      isStarred: message.isStarred,
      isFlagged: message.isFlagged,
      hasAttachments: message.hasAttachments,
      snoozedUntil: message.snoozedUntil,
      draftShared: message.draftShared,
      draftRevision: message.draftRevision,
      userId: message.userId,
      receivedAt: message.receivedAt,
    })
    .from(message)
    .where(and(...conds))
    .orderBy(desc(message.receivedAt), desc(message.id))
    .limit(pageSize + 1)
  const hasNextPage = rows.length > pageSize
  const pageRows = rows.slice(0, pageSize)
  const lastRow = pageRows.at(-1)
  const labelRows = pageRows.length
    ? await db.select({
      messageId: messageLabel.messageId,
      id: label.id,
      name: label.name,
      color: label.color,
    }).from(messageLabel)
      .innerJoin(label, eq(label.id, messageLabel.labelId))
      .where(and(inArray(messageLabel.messageId, pageRows.map((row) => row.id)), eq(label.teamId, team.id)))
    : []
  const labelsByMessage = new Map<number, { id: number; name: string; color: string }[]>()
  for (const item of labelRows) {
    const items = labelsByMessage.get(item.messageId) ?? []
    items.push({ id: item.id, name: item.name, color: item.color })
    labelsByMessage.set(item.messageId, items)
  }
  const assignmentRows = pageRows.length
    ? await db.select({ messageId: messageAssignment.messageId, userId: userTable.id, name: userTable.name, email: userTable.email })
      .from(messageAssignment)
      .innerJoin(userTable, eq(userTable.id, messageAssignment.assignedTo))
      .where(and(eq(messageAssignment.teamId, team.id), inArray(messageAssignment.messageId, pageRows.map((row) => row.id))))
    : []
  const assignmentsByMessage = new Map(assignmentRows.map((item) => [item.messageId, { userId: item.userId, name: item.name, email: item.email }]))
  return {
    messages: pageRows.map((row) => ({
      id: row.id,
      accountId: row.accountId,
      folderType: row.folderType as FolderType,
      fromName: row.fromName,
      fromAddress: row.fromAddress,
      toAddresses: row.toAddresses,
      ccAddresses: row.ccAddresses,
      subject: row.subject,
      preview: row.preview,
      body: "",
      htmlBody: null,
      isRead: row.isRead,
      isStarred: row.isStarred,
      isFlagged: row.isFlagged,
      hasAttachments: row.hasAttachments,
      snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
      draftShared: row.draftShared,
      draftRevision: row.draftRevision,
      draftOwnerId: row.userId,
      canManageDraftSharing: row.userId === user.id,
      receivedAt: row.receivedAt.toISOString(),
      labels: labelsByMessage.get(row.id) ?? [],
      assignment: assignmentsByMessage.get(row.id) ?? null,
    })),
    nextCursor: hasNextPage && lastRow
      ? { receivedAt: lastRow.receivedAt.toISOString(), id: lastRow.id }
      : null,
  }
}

export async function getMessage(id: number): Promise<MailMessage | null> {
  const { user, team } = await getUserAndTeam()
  const [row] = await db
    .select()
    .from(message)
    .where(and(eq(message.teamId, team.id), eq(message.id, id)))
  if (!row) return null
  if (row.folderType === "drafts" && row.userId !== user.id && !row.draftShared) return null
  const atts = await db
    .select()
    .from(attachment)
    .where(and(eq(attachment.teamId, team.id), eq(attachment.messageId, id)))
  const labels = await db.select({ id: label.id, name: label.name, color: label.color })
    .from(messageLabel)
    .innerJoin(label, eq(label.id, messageLabel.labelId))
    .where(and(eq(messageLabel.messageId, id), eq(label.teamId, team.id)))
  const [assignment] = await db.select({ userId: userTable.id, name: userTable.name, email: userTable.email })
    .from(messageAssignment).innerJoin(userTable, eq(userTable.id, messageAssignment.assignedTo))
    .where(and(eq(messageAssignment.teamId, team.id), eq(messageAssignment.messageId, id))).limit(1)
  const mail = toMail(row)
  if (looksLikeRawEmail(mail.body)) {
    const content = await parseMessageContent(mail.body)
    mail.body = content.text
    mail.htmlBody = content.html
  }
  return {
    ...mail,
    attachments: atts.map((a) => ({ id: a.id, filename: a.filename, mimeType: a.mimeType, size: a.size })),
    labels,
    assignment: assignment ?? null,
    canManageDraftSharing: row.userId === user.id,
  }
}

export async function getFolderCounts(accountId: number | "all"): Promise<FolderCount[]> {
  const { user, team } = await getUserAndTeam()
  const conds = [eq(message.teamId, team.id)]
  conds.push(or(ne(message.folderType, "drafts"), eq(message.userId, user.id), eq(message.draftShared, true))!)
  if (accountId !== "all") conds.push(eq(message.accountId, accountId))
  const rows = await db
    .select({
      folderType: message.folderType,
      total: sql<number>`count(*)::int`,
      unread: sql<number>`count(*) filter (where ${message.isRead} = false)::int`,
    })
    .from(message)
    .where(and(...conds))
    .groupBy(message.folderType)
  return rows.map((r) => ({ folderType: r.folderType as FolderType, total: r.total, unread: r.unread }))
}

export async function setRead(id: number | number[], isRead: boolean) {
  const ids = Array.isArray(id) ? id : [id]
  if (ids.length === 0) return
  const { user, team } = await getUserAndTeam()
  await assertDraftsAccessible(ids, team.id, user.id)
  const rows = await loadMutationRows(ids, team.id, user.id)
  const { outcomes, errors } = await applyImapOperation(rows, { type: "read", enabled: isRead })
  const safeIds = idsSafeToUpdate(rows, outcomes)
  if (safeIds.length) {
    await db.update(message).set({ isRead }).where(and(eq(message.teamId, team.id), inArray(message.id, safeIds)))
  }
  revalidatePath("/")
  if (errors.length) throw errors[0]
}

export async function toggleStar(id: number | number[], isStarred: boolean) {
  const ids = Array.isArray(id) ? id : [id]
  if (ids.length === 0) return
  const { user, team } = await getUserAndTeam()
  await assertDraftsAccessible(ids, team.id, user.id)
  const rows = await loadMutationRows(ids, team.id, user.id)
  const { outcomes, errors } = await applyImapOperation(rows, { type: "star", enabled: isStarred })
  const safeIds = idsSafeToUpdate(rows, outcomes)
  if (safeIds.length) {
    await db.update(message).set({ isStarred }).where(and(eq(message.teamId, team.id), inArray(message.id, safeIds)))
  }
  revalidatePath("/")
  if (errors.length) throw errors[0]
}

export async function toggleFlag(id: number, isFlagged: boolean) {
  const { user, team } = await getUserAndTeam()
  await assertDraftsAccessible([id], team.id, user.id)
  const rows = await loadMutationRows([id], team.id, user.id)
  const { outcomes, errors } = await applyImapOperation(rows, { type: "flag", enabled: isFlagged })
  const safeIds = idsSafeToUpdate(rows, outcomes)
  if (safeIds.length) {
    await db.update(message).set({ isFlagged }).where(and(eq(message.teamId, team.id), inArray(message.id, safeIds)))
  }
  revalidatePath("/")
  if (errors.length) throw errors[0]
}

export async function moveToFolder(ids: number[], folderType: FolderType) {
  const { user, team } = await getUserAndTeam()
  if (ids.length === 0) return
  await assertDraftsOwned(ids, team.id, user.id)
  const rows = await loadMutationRows(ids, team.id, user.id)
  const { outcomes, errors } = await applyImapOperation(rows, { type: "move", destination: folderType })
  const safeIds = idsSafeToUpdate(rows, outcomes)
  if (safeIds.length) {
    await db.update(message).set({ folderType }).where(and(eq(message.teamId, team.id), inArray(message.id, safeIds)))
  }
  for (const outcome of outcomes) {
    if (!outcome.destinationPath) continue
    await db
      .update(message)
      .set({ folderPath: outcome.destinationPath, messageUid: outcome.messageUid ?? null })
      .where(and(eq(message.teamId, team.id), eq(message.id, outcome.messageId)))
  }
  revalidatePath("/")
  if (errors.length) throw errors[0]
}

export async function deleteForever(ids: number[]) {
  const { user, team } = await getUserAndTeam()
  if (ids.length === 0) return
  await assertDraftsOwned(ids, team.id, user.id)
  const rows = await loadMutationRows(ids, team.id, user.id)
  const { outcomes, errors } = await applyImapOperation(rows, { type: "delete" })
  const safeIds = idsSafeToUpdate(rows, outcomes)
  if (safeIds.length) {
    await db.delete(attachment).where(and(eq(attachment.teamId, team.id), inArray(attachment.messageId, safeIds)))
    await db.delete(message).where(and(eq(message.teamId, team.id), inArray(message.id, safeIds)))
  }
  revalidatePath("/")
  if (errors.length) throw errors[0]
}

export interface SendInput {
  accountId: number
  to: string
  cc?: string
  subject: string
  body: string
  htmlBody?: string
  bcc?: string
  attachments: { filename: string; content: Buffer; mimeType: string; size: number; cid?: string; contentDisposition?: "inline" | "attachment" }[]
}

export async function snoozeMessage(id: number, until: Date) {
  const { user, team } = await getUserAndTeam()
  await assertDraftsOwned([id], team.id, user.id)
  await db
    .update(message)
    .set({ snoozedUntil: until, folderType: "snoozed" })
    .where(and(eq(message.teamId, team.id), eq(message.id, id)))
  revalidatePath("/")
}

export async function unsnoozeMessage(id: number) {
  const { user, team } = await getUserAndTeam()
  await assertDraftsOwned([id], team.id, user.id)
  await db
    .update(message)
    .set({ snoozedUntil: null, folderType: "inbox" })
    .where(and(eq(message.teamId, team.id), eq(message.id, id)))
  revalidatePath("/")
}

export async function saveDraft(input: {
  draftId?: number
  expectedRevision?: number
  shareWithTeam?: boolean
  accountId: number
  to: string
  cc: string
  subject: string
  body: string
  htmlBody: string
}) {
  const { user, team } = await getUserAndTeam()
  if (input.draftId !== undefined && (!Number.isSafeInteger(input.draftId) || input.draftId < 1)) {
    throw new AppError("Draft not found", "NOT_FOUND", 404)
  }
  const draftId = Number.isSafeInteger(input.draftId) && input.draftId! > 0 ? input.draftId! : undefined
  const existingDraft = draftId
    ? (await db.select().from(message).where(and(
      eq(message.id, draftId),
      eq(message.teamId, team.id),
      eq(message.folderType, "drafts"),
    )).limit(1))[0]
    : undefined

  if (draftId && !existingDraft) throw new AppError("Draft not found", "NOT_FOUND", 404)
  if (existingDraft && existingDraft.userId !== user.id && !existingDraft.draftShared) {
    throw new AppError("This draft is private", "FORBIDDEN", 403)
  }

  const isCollaborator = Boolean(existingDraft && existingDraft.userId !== user.id)
  const accountId = isCollaborator ? existingDraft!.accountId : input.accountId
  const account = isCollaborator
    ? null
    : (await db.select({ id: mailAccount.id, displayName: mailAccount.displayName, emailAddress: mailAccount.emailAddress })
      .from(mailAccount)
      .where(and(eq(mailAccount.id, accountId), eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id)))
      .limit(1))[0]
  if (!isCollaborator && !account) throw new AppError("Account not found", "NOT_FOUND", 404)

  const expectedRevision = input.expectedRevision
  if (existingDraft && (!Number.isSafeInteger(expectedRevision) || expectedRevision !== existingDraft.draftRevision)) {
    throw new AppError("This draft changed in another window. Reload the latest version before saving.", "CONFLICT", 409)
  }
  if (isCollaborator && input.shareWithTeam !== undefined && input.shareWithTeam !== existingDraft!.draftShared) {
    throw new AppError("Only the draft owner can change sharing", "FORBIDDEN", 403)
  }

  const body = input.body.slice(0, 1_000_000)
  const htmlBody = input.htmlBody ? sanitizeEmailHtml(input.htmlBody.slice(0, 2_000_000)) : null
  const values = {
    teamId: team.id,
    userId: existingDraft?.userId ?? user.id,
    accountId,
    folderType: "drafts",
    fromName: isCollaborator ? existingDraft!.fromName : account!.displayName,
    fromAddress: isCollaborator ? existingDraft!.fromAddress : account!.emailAddress,
    toAddresses: input.to.slice(0, 10_000),
    ccAddresses: input.cc.slice(0, 10_000),
    subject: input.subject.slice(0, 10_000),
    preview: body.replace(/\s+/g, " ").slice(0, 110).trim(),
    body,
    htmlBody,
    isRead: true,
    isStarred: false,
    isFlagged: false,
    hasAttachments: false,
    draftShared: existingDraft
      ? (isCollaborator ? existingDraft.draftShared : input.shareWithTeam ?? existingDraft.draftShared)
      : Boolean(input.shareWithTeam),
    receivedAt: new Date(),
  }

  if (existingDraft) {
    const [updated] = await db
      .update(message)
      .set({ ...values, draftRevision: existingDraft.draftRevision + 1 })
      .where(and(
        eq(message.id, existingDraft.id),
        eq(message.teamId, team.id),
        eq(message.folderType, "drafts"),
        eq(message.draftRevision, expectedRevision!),
        or(eq(message.userId, user.id), eq(message.draftShared, true)),
      ))
      .returning({ id: message.id, draftRevision: message.draftRevision })
    if (updated) {
      if (existingDraft.draftShared !== (input.shareWithTeam ?? existingDraft.draftShared) && !isCollaborator) {
        await recordTeamAuditLog({
          teamId: team.id,
          actorId: user.id,
          action: input.shareWithTeam ? "draft_shared" : "draft_unshared",
          targetType: "draft",
          targetId: existingDraft.id,
        })
      }
      revalidatePath("/")
      return { draftId: updated.id, draftRevision: updated.draftRevision }
    }
    throw new AppError("This draft changed in another window. Reload the latest version before saving.", "CONFLICT", 409)
  }

  const [created] = await db.insert(message).values({ ...values, draftRevision: 1 }).returning({ id: message.id, draftRevision: message.draftRevision })
  if (values.draftShared) {
    await recordTeamAuditLog({ teamId: team.id, actorId: user.id, action: "draft_shared", targetType: "draft", targetId: created.id })
  }
  revalidatePath("/")
  return { draftId: created.id, draftRevision: created.draftRevision }
}

export async function sendMessage(formData: FormData) {
  const rawAccountId = formData.get("accountId")
  const accountId = Number(rawAccountId)
  if (!Number.isInteger(accountId) || accountId < 1) throw new AppError("Choose a valid sending account", "VALIDATION", 400)
  const getText = (key: string) => {
    const value = formData.get(key)
    return typeof value === "string" ? value : ""
  }
  const input: SendInput = {
    accountId,
    to: getText("to"),
    cc: getText("cc"),
    bcc: getText("bcc"),
    subject: getText("subject"),
    body: getText("body"),
    htmlBody: getText("htmlBody"),
    attachments: [],
  }
  const rawDraftId = formData.get("draftId")
  const draftId = rawDraftId === null ? Number.NaN : Number(rawDraftId)
  const expectedDraftRevision = Number(formData.get("draftRevision"))
  if (rawDraftId !== null && (!Number.isSafeInteger(draftId) || draftId < 1)) {
    throw new AppError("Draft not found", "NOT_FOUND", 404)
  }
  const files = formData.getAll("attachments").filter((value): value is File => typeof value !== "string")
  if (files.length > 10) throw new AppError("You can attach up to 10 files", "VALIDATION", 400)
  if (files.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) {
    throw new AppError("Attachments must total 20 MB or less", "VALIDATION", 400)
  }
  input.attachments = await Promise.all(files.map(async (file) => ({
    filename: file.name.replace(/[\\/\r\n"]/g, "_"),
    content: Buffer.from(await file.arrayBuffer()),
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  })))

  const inlineImages: { cid: string; dataUrl: string }[] = []
  const htmlWithCid = (input.htmlBody ?? "").replace(
    /src=(["'])data:image\/(png|jpeg|gif|webp);base64,([a-z\d+/]+={0,2})\1/gi,
    (match, quote: string, extension: string, encoded: string) => {
      const content = Buffer.from(encoded, "base64")
      if (!content.length || content.length > 5 * 1024 * 1024) {
        throw new AppError("Each inserted image must be 5 MB or smaller", "VALIDATION", 400)
      }
      const cid = `${randomUUID()}@mailapp`
      const normalizedType = extension.toLowerCase() === "jpg" ? "jpeg" : extension.toLowerCase()
      const validImage = normalizedType === "png"
        ? content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : normalizedType === "jpeg"
          ? content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
          : normalizedType === "gif"
            ? content.subarray(0, 6).toString("ascii").startsWith("GIF8")
            : content.subarray(0, 4).toString("ascii") === "RIFF" && content.subarray(8, 12).toString("ascii") === "WEBP"
      if (!validImage) throw new AppError("An inserted image is not a valid image file", "VALIDATION", 400)
      const dataUrl = `data:image/${normalizedType};base64,${encoded}`
      const filename = `inline-image-${inlineImages.length + 1}.${normalizedType === "jpeg" ? "jpg" : normalizedType}`
      inlineImages.push({ cid, dataUrl })
      input.attachments.push({
        filename,
        content,
        mimeType: `image/${normalizedType}`,
        size: content.length,
        cid,
        contentDisposition: "inline",
      })
      return `src=${quote}cid:${cid}${quote}`
    },
  )

  if (input.attachments.length > 10) throw new AppError("You can send up to 10 attachments and inserted images", "VALIDATION", 400)
  if (input.attachments.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) {
    throw new AppError("Attachments and inserted images must total 20 MB or less", "VALIDATION", 400)
  }
  const safeHtmlBody = input.htmlBody ? sanitizeEmailHtml(htmlWithCid) : undefined
  const storedHtmlBody = safeHtmlBody?.replace(/cid:([\da-f-]+@mailapp)/gi, (cidUrl) => {
    const inline = inlineImages.find((image) => `cid:${image.cid}`.toLowerCase() === cidUrl.toLowerCase())
    return inline?.dataUrl ?? cidUrl
  })

  const { user, team } = await getUserAndTeam()

  if (Number.isSafeInteger(draftId) && draftId > 0) {
    const [sourceDraft] = await db.select({ userId: message.userId, folderType: message.folderType, draftRevision: message.draftRevision })
      .from(message)
      .where(and(eq(message.id, draftId), eq(message.teamId, team.id)))
      .limit(1)
    if (!sourceDraft || sourceDraft.folderType !== "drafts" || sourceDraft.userId !== user.id) {
      throw new AppError("Only the owner can send or remove a shared draft", "FORBIDDEN", 403)
    }
    if (!Number.isSafeInteger(expectedDraftRevision) || expectedDraftRevision !== sourceDraft.draftRevision) {
      throw new AppError("This draft changed in another window. Reload the latest version before sending.", "CONFLICT", 409)
    }
  }

  const [acct] = await db
    .select({ id: mailAccount.id })
    .from(mailAccount)
    .where(and(eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id), eq(mailAccount.id, input.accountId)))
  if (!acct) throw new AppError("Account not found", "NOT_FOUND", 404)
  const payload: QueuedMailPayload = {
    to: input.to,
    cc: input.cc ?? "",
    bcc: input.bcc ?? "",
    subject: input.subject,
    body: input.body,
    htmlBody: safeHtmlBody,
    storedHtmlBody,
    draftId: Number.isSafeInteger(draftId) && draftId > 0 ? draftId : undefined,
    draftRevision: Number.isSafeInteger(draftId) && draftId > 0 ? expectedDraftRevision : undefined,
    attachments: input.attachments.map((file) => ({
      filename: file.filename,
      contentBase64: file.content.toString("base64"),
      mimeType: file.mimeType,
      size: file.size,
      cid: file.cid,
      contentDisposition: file.contentDisposition,
    })),
  }
  const [queued] = await db.insert(outgoingQueue).values({
    teamId: team.id,
    userId: user.id,
    accountId: input.accountId,
    payload,
    scheduledAt: new Date(Date.now() + 5_000),
  }).returning({ id: outgoingQueue.id })
  revalidatePath("/")
  return { ok: true, queuedId: queued.id }
}

export async function cancelQueuedMessage(queueId: number) {
  const { user, team } = await getUserAndTeam()
  if (!Number.isSafeInteger(queueId) || queueId < 1) return { cancelled: false }
  const [cancelled] = await db.update(outgoingQueue)
    .set({ status: "cancelled", payload: null })
    .where(and(
      eq(outgoingQueue.id, queueId),
      eq(outgoingQueue.teamId, team.id),
      eq(outgoingQueue.userId, user.id),
      eq(outgoingQueue.status, "queued"),
    ))
    .returning({ id: outgoingQueue.id })
  revalidatePath("/")
  return { cancelled: Boolean(cancelled) }
}

export async function deliverQueuedMessageForUser(queueId: number) {
  const { user, team } = await getUserAndTeam()
  const result = await deliverQueuedMessage(queueId, { teamId: team.id, userId: user.id })
  revalidatePath("/")
  return result
}
