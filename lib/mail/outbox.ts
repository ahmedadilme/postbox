import "server-only"
import { and, eq, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { attachment, mailAccount, message, outgoingQueue } from "@/lib/db/schema"
import { decrypt } from "@/lib/encryption"
import { getValidAccessToken } from "@/lib/oauth/refresh"
import { sendEmail } from "@/lib/mail/provider"

export interface QueuedAttachment {
  filename: string
  contentBase64: string
  mimeType: string
  size: number
  cid?: string
  contentDisposition?: "inline" | "attachment"
}

export interface QueuedMailPayload {
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  htmlBody?: string
  storedHtmlBody?: string
  draftId?: number
  draftRevision?: number
  attachments: QueuedAttachment[]
}

type QueueRow = typeof outgoingQueue.$inferSelect

async function deliverClaimed(row: QueueRow): Promise<boolean> {
  try {
    const [account] = await db.select().from(mailAccount).where(and(
      eq(mailAccount.id, row.accountId),
      eq(mailAccount.teamId, row.teamId),
    )).limit(1)
    if (!account || !row.payload) throw new Error("Sending account or queued message is unavailable")

    const payload = row.payload as QueuedMailPayload
    const accessToken = account.authType === "oauth" ? await getValidAccessToken(account.id) : undefined
    const attachmentsForSend = payload.attachments.map((file) => ({
      filename: file.filename,
      content: Buffer.from(file.contentBase64, "base64"),
      mimeType: file.mimeType,
      cid: file.cid,
      contentDisposition: file.contentDisposition,
    }))
    const result = await sendEmail({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,
      username: account.smtpUsername,
      password: decrypt(account.smtpPassword),
      accessToken,
    }, {
      from: { name: account.displayName, address: account.emailAddress },
      to: payload.to.split(",").map((value) => value.trim()).filter(Boolean),
      cc: payload.cc.split(",").map((value) => value.trim()).filter(Boolean),
      bcc: payload.bcc.split(",").map((value) => value.trim()).filter(Boolean),
      subject: payload.subject,
      body: payload.body,
      htmlBody: payload.htmlBody,
      attachments: attachmentsForSend,
    })
    if (!result.ok) throw new Error(result.error || "Failed to send email")

    const [sent] = await db.insert(message).values({
      teamId: row.teamId,
      userId: row.userId,
      accountId: account.id,
      folderType: "sent",
      fromName: account.displayName,
      fromAddress: account.emailAddress,
      toAddresses: payload.to,
      ccAddresses: payload.cc,
      subject: payload.subject,
      preview: payload.body.replace(/\n/g, " ").slice(0, 110).trim(),
      body: payload.body,
      htmlBody: payload.storedHtmlBody ?? null,
      isRead: true,
      isStarred: false,
      isFlagged: false,
      hasAttachments: payload.attachments.length > 0,
      receivedAt: new Date(),
    }).returning({ id: message.id })

    if (payload.attachments.length) {
      await db.insert(attachment).values(payload.attachments.map((file) => ({
        teamId: row.teamId,
        userId: row.userId,
        messageId: sent.id,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
      })))
    }
    if (payload.draftId && Number.isSafeInteger(payload.draftId) && payload.draftId > 0) {
      await db.delete(message).where(and(
        eq(message.id, payload.draftId),
        eq(message.teamId, row.teamId),
        eq(message.userId, row.userId),
        eq(message.folderType, "drafts"),
        ...(Number.isSafeInteger(payload.draftRevision) ? [eq(message.draftRevision, payload.draftRevision!)] : []),
      ))
    }
    await db.update(outgoingQueue).set({ status: "sent", payload: null, errorMessage: null }).where(eq(outgoingQueue.id, row.id))
    return true
  } catch (error) {
    // Do not automatically retry SMTP failures: a connection can fail after
    // the remote server accepted the message, and retrying could duplicate it.
    const messageText = error instanceof Error ? error.message : "Message delivery failed"
    await db.update(outgoingQueue).set({ status: "error", payload: null, errorMessage: messageText.slice(0, 1000) }).where(eq(outgoingQueue.id, row.id))
    return false
  }
}

export async function deliverQueuedMessage(queueId: number, scope?: { teamId: string; userId: string }) {
  const now = new Date()
  const conditions = [
    eq(outgoingQueue.id, queueId),
    eq(outgoingQueue.status, "queued"),
    lte(outgoingQueue.scheduledAt, now),
  ]
  if (scope) conditions.push(eq(outgoingQueue.teamId, scope.teamId), eq(outgoingQueue.userId, scope.userId))
  const [claimed] = await db.update(outgoingQueue)
    .set({ status: "sending" })
    .where(and(...conditions))
    .returning()
  if (!claimed) return { sent: false, claimed: false }
  return { sent: await deliverClaimed(claimed), claimed: true }
}

export async function processDueOutgoingMessages(limit = 25) {
  const due = await db.select({ id: outgoingQueue.id }).from(outgoingQueue)
    .where(and(eq(outgoingQueue.status, "queued"), lte(outgoingQueue.scheduledAt, new Date())))
    .limit(limit)
  let sent = 0
  let failed = 0
  for (const row of due) {
    const result = await deliverQueuedMessage(row.id)
    if (result.sent) sent++
    else if (result.claimed) failed++
  }
  return { sent, failed }
}
