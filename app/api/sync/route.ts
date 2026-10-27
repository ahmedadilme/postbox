import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { db } from "@/lib/db"
import { mailAccount, message, attachment } from "@/lib/db/schema"
import { syncAllFolders } from "@/lib/mail/provider"
import { decrypt } from "@/lib/encryption"
import { getValidAccessToken } from "@/lib/oauth/refresh"
import { and, eq, sql, or, isNull, lt } from "drizzle-orm"
import { processDueOutgoingMessages } from "@/lib/mail/outbox"

export async function GET(request: NextRequest) {
  const cronSecret = process.env.SYNC_CRON_SECRET
  if (!cronSecret) {
    console.error("SYNC_CRON_SECRET is not configured; scheduled sync is disabled")
    return NextResponse.json({ error: "Sync endpoint is not configured" }, { status: 503 })
  }

  const authorization = request.headers.get("authorization")
  const providedSecret = authorization?.startsWith("Bearer ") ? authorization.slice(7) : ""
  const providedBuffer = Buffer.from(providedSecret)
  const expectedBuffer = Buffer.from(cronSecret)
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const outbox = await processDueOutgoingMessages()
  const retryBefore = new Date(Date.now() - 5 * 60 * 1000)
  const recoverBefore = new Date(Date.now() - 30 * 60 * 1000)
  const candidates = await db
    .select()
    .from(mailAccount)
    .where(or(
      eq(mailAccount.syncStatus, "idle"),
      and(eq(mailAccount.syncStatus, "error"), or(isNull(mailAccount.syncAttemptAt), lt(mailAccount.syncAttemptAt, retryBefore)))!,
      and(eq(mailAccount.syncStatus, "syncing"), or(isNull(mailAccount.syncAttemptAt), lt(mailAccount.syncAttemptAt, recoverBefore)))!,
    ))

  let synced = 0
  let failed = 0

  for (const acct of candidates) {
    try {
      // Claim idle accounts, retry older failures, and recover stale syncs.
      // The conditional update prevents overlapping cron and manual sync runs.
      const attemptAt = new Date()
      const [claimed] = await db
        .update(mailAccount)
        .set({ syncStatus: "syncing", syncAttemptAt: attemptAt, syncError: null })
        .where(and(
          eq(mailAccount.id, acct.id),
          or(
            eq(mailAccount.syncStatus, "idle"),
            and(eq(mailAccount.syncStatus, "error"), or(isNull(mailAccount.syncAttemptAt), lt(mailAccount.syncAttemptAt, retryBefore)))!,
            and(eq(mailAccount.syncStatus, "syncing"), or(isNull(mailAccount.syncAttemptAt), lt(mailAccount.syncAttemptAt, recoverBefore)))!,
          )!,
        ))
        .returning({ id: mailAccount.id })
      if (!claimed) continue

      const existingRows = await db
        .select({
          folderPath: message.folderPath,
          minUid: sql<number>`min(${message.messageUid})`,
          maxUid: sql<number>`max(${message.messageUid})`,
        })
        .from(message)
        .where(and(eq(message.teamId, acct.teamId), eq(message.accountId, acct.id)))
        .groupBy(message.folderPath)

      const existingUids = existingRows
        .filter((r) => r.folderPath && r.maxUid)
        .map((r) => ({ folderPath: r.folderPath!, minUid: r.minUid, maxUid: r.maxUid }))

      const accessToken = acct.authType === "oauth" ? await getValidAccessToken(acct.id) : undefined
      const syncedMsgs = await syncAllFolders(
        {
          host: acct.incomingHost,
          port: acct.incomingPort,
          secure: acct.incomingSecure,
          username: acct.incomingUsername,
          password: acct.authType === "oauth" ? "" : decrypt(acct.incomingPassword),
          accessToken,
        },
        existingUids,
      )

      for (const s of syncedMsgs) {
        const [msg] = await db
          .insert(message)
          .values({
            teamId: acct.teamId,
            userId: acct.userId,
            accountId: acct.id,
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
            teamId: acct.teamId,
            userId: acct.userId,
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
        .where(eq(mailAccount.id, acct.id))

      synced++
    } catch (error) {
      const details = error instanceof Error ? error as Error & { responseText?: string } : null
      let syncError = (details?.responseText || details?.message || "Unknown sync error").replace(/\s+/g, " ")
      let incomingPassword = ""
      try {
        if (acct.authType !== "oauth") incomingPassword = decrypt(acct.incomingPassword)
      } catch {
        // Keep the original sync error if the stored credential itself is unreadable.
      }
      if (acct.incomingUsername) syncError = syncError.replaceAll(acct.incomingUsername, "[account]")
      if (incomingPassword) syncError = syncError.replaceAll(incomingPassword, "[redacted]")
      syncError = syncError.slice(0, 500) || "Unknown sync error"
      console.error("Scheduled mailbox sync failed", { accountId: acct.id, error: syncError })
      await db
        .update(mailAccount)
        .set({ syncStatus: "error", syncAttemptAt: new Date(), syncError })
        .where(eq(mailAccount.id, acct.id))
      failed++
    }
  }

  return NextResponse.json({ synced, failed, outbox })
}
