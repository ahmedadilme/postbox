"use server"

import { db } from "@/lib/db"
import { mailAccount, mailSignature, message, attachment } from "@/lib/db/schema"
import { and, eq, inArray, sql, or, isNull, lt } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { syncAllFolders, testConnection as realTestConnection } from "@/lib/mail/provider"
import { encrypt, decrypt } from "@/lib/encryption"
import { getValidAccessToken } from "@/lib/oauth/refresh"
import { getUserAndTeam } from "@/lib/team"
import { checkLimit } from "@/lib/billing/features"
import type { MailAccount } from "@/lib/mail/types"
import { ACCOUNT_COLORS } from "@/lib/mail/types"
import { recordTeamAuditLog } from "@/lib/team/audit-log"

export async function getAccounts(): Promise<MailAccount[]> {
  const { user, team } = await getUserAndTeam()
  const rows = await db
    .select()
    .from(mailAccount)
    .where(and(eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id)))
    .orderBy(mailAccount.id)

  const signatureRows = rows.length
    ? await db
        .select({
          id: mailSignature.id,
          accountId: mailSignature.accountId,
          name: mailSignature.name,
          body: mailSignature.body,
          isDefault: mailSignature.isDefault,
        })
        .from(mailSignature)
        .where(and(eq(mailSignature.teamId, team.id), inArray(mailSignature.accountId, rows.map((row) => row.id))))
    : []

  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    emailAddress: r.emailAddress,
    color: r.color,
    incomingProtocol: r.incomingProtocol as "imap" | "pop3",
    incomingHost: r.incomingHost,
    incomingPort: r.incomingPort,
    incomingSecure: r.incomingSecure,
    incomingUsername: r.incomingUsername,
    smtpHost: r.smtpHost,
    smtpPort: r.smtpPort,
    smtpSecure: r.smtpSecure,
    smtpUsername: r.smtpUsername,
    signature: r.signature ?? "",
    signatures: signatureRows.filter((signature) => signature.accountId === r.id),
    defaultSignatureId: r.defaultSignatureId,
    authType: (r.authType ?? "password") as "password" | "oauth",
    oauthProvider: r.oauthProvider ?? null,
    syncStatus: (r.syncStatus ?? "idle") as "idle" | "syncing" | "error",
    lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
    syncAttemptAt: r.syncAttemptAt?.toISOString() ?? null,
    syncError: r.syncError,
    createdAt: r.createdAt.toISOString(),
  }))
}

export interface AddAccountInput {
  displayName: string
  emailAddress: string
  incomingProtocol: "imap" | "pop3"
  incomingHost: string
  incomingPort: number
  incomingSecure: boolean
  incomingUsername: string
  incomingPassword: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUsername: string
  smtpPassword: string
}

export async function testAccountConnection(input: AddAccountInput) {
  await getUserAndTeam()
  if (input.incomingProtocol !== "imap") {
    return { ok: false, message: "POP3 accounts are not supported yet. Choose IMAP." }
  }
  return realTestConnection({
    incomingHost: input.incomingHost,
    incomingPort: input.incomingPort,
    incomingSecure: input.incomingSecure,
    incomingUsername: input.incomingUsername,
    incomingPassword: input.incomingPassword,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    smtpUsername: input.smtpUsername,
    smtpPassword: input.smtpPassword,
  })
}

export async function addAccount(input: AddAccountInput) {
  const { user, team } = await getUserAndTeam()
  if (input.incomingProtocol !== "imap") {
    throw new Error("POP3 accounts are not supported yet. Choose IMAP.")
  }

  const existing = await db
    .select({ id: mailAccount.id })
    .from(mailAccount)
    .where(and(eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id)))

  const color = ACCOUNT_COLORS[existing.length % ACCOUNT_COLORS.length]

  // Check account limit for the plan
  const accountLimit = checkLimit(team.plan, "maxAccounts", existing.length)
  if (accountLimit.remaining === "Limit reached") {
    throw new Error(`Account limit reached for the ${team.plan} plan. Upgrade to add more accounts.`)
  }

  const [created] = await db
    .insert(mailAccount)
    .values({
      teamId: team.id,
      userId: user.id,
      displayName: input.displayName,
      emailAddress: input.emailAddress,
      color,
      incomingProtocol: input.incomingProtocol,
      incomingHost: input.incomingHost,
      incomingPort: input.incomingPort,
      incomingSecure: input.incomingSecure,
      incomingUsername: input.incomingUsername,
      incomingPassword: encrypt(input.incomingPassword),
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpSecure: input.smtpSecure,
      smtpUsername: input.smtpUsername,
      smtpPassword: encrypt(input.smtpPassword),
      authType: "password",
      syncStatus: "idle",
    })
    .returning()
  revalidatePath("/")
  await recordTeamAuditLog({ teamId: team.id, actorId: user.id, action: "account_added", targetType: "mail_account", targetId: created.id, metadata: { emailAddress: created.emailAddress } })
  return { id: created.id }
}

export async function updateAccount(accountId: number, input: Partial<AddAccountInput & { signature: string }>) {
  const { user, team } = await getUserAndTeam()
  const updates: Record<string, string | number | boolean> = {}
  if (input.displayName !== undefined) updates.displayName = input.displayName
  if (input.emailAddress !== undefined) updates.emailAddress = input.emailAddress
  if (input.incomingProtocol !== undefined) updates.incomingProtocol = input.incomingProtocol
  if (input.incomingHost !== undefined) updates.incomingHost = input.incomingHost
  if (input.incomingPort !== undefined) updates.incomingPort = input.incomingPort
  if (input.incomingSecure !== undefined) updates.incomingSecure = input.incomingSecure
  if (input.incomingUsername !== undefined) updates.incomingUsername = input.incomingUsername
  if (input.incomingPassword !== undefined) updates.incomingPassword = encrypt(input.incomingPassword)
  if (input.smtpHost !== undefined) updates.smtpHost = input.smtpHost
  if (input.smtpPort !== undefined) updates.smtpPort = input.smtpPort
  if (input.smtpSecure !== undefined) updates.smtpSecure = input.smtpSecure
  if (input.smtpUsername !== undefined) updates.smtpUsername = input.smtpUsername
  if (input.smtpPassword !== undefined) updates.smtpPassword = encrypt(input.smtpPassword)
  if (input.signature !== undefined) updates.signature = input.signature

  await db
    .update(mailAccount)
    .set(updates)
    .where(and(eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id), eq(mailAccount.id, accountId)))
  revalidatePath("/")
}

export async function syncAccount(accountId: number) {
  const { user, team } = await getUserAndTeam()

  const [acct] = await db
    .select()
    .from(mailAccount)
    .where(and(eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id), eq(mailAccount.id, accountId)))
  if (!acct) throw new Error("Account not found")

  let syncStage = "checking mailbox position"
  let syncPassword = ""
  const attemptAt = new Date()
  const [claimed] = await db
    .update(mailAccount)
    .set({ syncStatus: "syncing", syncAttemptAt: attemptAt, syncError: null })
    .where(and(
      eq(mailAccount.id, accountId),
      eq(mailAccount.teamId, team.id),
      eq(mailAccount.userId, user.id),
      or(
        eq(mailAccount.syncStatus, "idle"),
        eq(mailAccount.syncStatus, "error"),
        and(eq(mailAccount.syncStatus, "syncing"), or(isNull(mailAccount.syncAttemptAt), lt(mailAccount.syncAttemptAt, new Date(Date.now() - 30 * 60 * 1000))))!,
      )!,
    ))
    .returning({ id: mailAccount.id })
  if (!claimed) throw new Error("This account is already syncing")

  try {
    const existingRows = await db
      .select({
        folderPath: message.folderPath,
        minUid: sql<number>`min(${message.messageUid})`,
        maxUid: sql<number>`max(${message.messageUid})`,
      })
      .from(message)
      .where(and(eq(message.teamId, team.id), eq(message.accountId, accountId)))
      .groupBy(message.folderPath)

    const existingUids = existingRows
      .filter((r) => r.folderPath && r.maxUid)
      .map((r) => ({ folderPath: r.folderPath!, minUid: r.minUid, maxUid: r.maxUid }))

    // For OAuth accounts, get a fresh access token
    let accessToken: string | undefined
    if (acct.authType === "oauth") {
      accessToken = await getValidAccessToken(accountId)
    } else {
      syncPassword = decrypt(acct.incomingPassword)
    }

    syncStage = "fetching messages from IMAP"
    const synced = await syncAllFolders(
      {
        host: acct.incomingHost,
        port: acct.incomingPort,
        secure: acct.incomingSecure,
        username: acct.incomingUsername,
        password: syncPassword,
        accessToken,
      },
      existingUids,
    )

    for (const s of synced) {
      syncStage = `saving message ${s.messageUid} from ${s.folderPath}`
      const [msg] = await db
        .insert(message)
        .values({
          teamId: team.id,
          userId: user.id,
          accountId,
          folderType: s.folderType,
          messageUid: s.messageUid,
          folderPath: s.folderPath,
          fromName: s.fromName,
          fromAddress: s.fromAddress,
          toAddresses: s.toAddresses,
          ccAddresses: s.ccAddresses,
          subject: s.subject,
          preview: s.subject.slice(0, 110),
          body: s.body,
          htmlBody: s.htmlBody,
          isRead: s.isRead,
          isStarred: s.isStarred,
          isFlagged: s.isFlagged,
          hasAttachments: s.hasAttachments,
          receivedAt: s.receivedAt,
        })
        .returning()

      for (const att of s.attachments) {
        await db.insert(attachment).values({
          teamId: team.id,
          userId: user.id,
          messageId: msg.id,
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
        })
      }
    }

    await db
      .update(mailAccount)
      .set({ syncStatus: "idle", lastSyncAt: new Date(), syncAttemptAt: null, syncError: null })
      .where(eq(mailAccount.id, accountId))
  } catch (err) {
    const details = err instanceof Error ? err as Error & {
      responseText?: string
      responseStatus?: string
      executedCommand?: string
    } : null
    let msg = details?.responseText || details?.message || "Unknown sync error"
    msg = msg.replace(/\s+/g, " ")
    if (acct.incomingUsername) msg = msg.replaceAll(acct.incomingUsername, "[account]")
    if (syncPassword) msg = msg.replaceAll(syncPassword, "[redacted]")
    msg = msg.slice(0, 500) || "Unknown sync error"
    console.error("Account email sync failed", {
      accountId,
      stage: syncStage,
      message: details?.message ?? String(err),
      responseStatus: details?.responseStatus,
      responseText: details?.responseText,
      executedCommand: details?.executedCommand?.split(/\s/, 1)[0],
    })
    await db
      .update(mailAccount)
      .set({ syncStatus: "error", syncAttemptAt: new Date(), syncError: msg })
      .where(and(eq(mailAccount.id, accountId), eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id)))
    throw new Error(msg)
  }

  revalidatePath("/")
}

export async function deleteAccount(accountId: number) {
  const { user, team } = await getUserAndTeam()

  const [account] = await db.select({ emailAddress: mailAccount.emailAddress }).from(mailAccount)
    .where(and(eq(mailAccount.teamId, team.id), eq(mailAccount.userId, user.id), eq(mailAccount.id, accountId))).limit(1)
  if (!account) throw new Error("Account not found")

  const msgs = await db
    .select({ id: message.id })
    .from(message)
    .where(and(eq(message.teamId, team.id), eq(message.accountId, accountId)))

  const msgIds = msgs.map((m) => m.id)
  if (msgIds.length > 0) {
    await db.delete(attachment).where(and(eq(attachment.teamId, team.id), inArray(attachment.messageId, msgIds)))
  }
  await db.delete(message).where(and(eq(message.teamId, team.id), eq(message.accountId, accountId)))
  await db.delete(mailAccount).where(and(eq(mailAccount.teamId, team.id), eq(mailAccount.id, accountId)))
  await recordTeamAuditLog({ teamId: team.id, actorId: user.id, action: "account_removed", targetType: "mail_account", targetId: accountId, metadata: { emailAddress: account.emailAddress } })
  revalidatePath("/")
}
