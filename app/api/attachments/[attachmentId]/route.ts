import { NextRequest, NextResponse } from "next/server"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { attachment, mailAccount, message } from "@/lib/db/schema"
import { decrypt } from "@/lib/encryption"
import { getValidAccessToken } from "@/lib/oauth/refresh"
import { downloadImapAttachment } from "@/lib/mail/provider"
import { getUserAndTeam } from "@/lib/team"

export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  let teamId: string
  try {
    const context = await getUserAndTeam()
    teamId = context.team.id
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { attachmentId: rawId } = await params
  const attachmentId = Number(rawId)
  if (!Number.isSafeInteger(attachmentId) || attachmentId <= 0) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
  }

  const [record] = await db
    .select({
      id: attachment.id,
      messageId: message.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      messageUid: message.messageUid,
      folderPath: message.folderPath,
      subject: message.subject,
      fromAddress: message.fromAddress,
      accountId: mailAccount.id,
      incomingHost: mailAccount.incomingHost,
      incomingPort: mailAccount.incomingPort,
      incomingSecure: mailAccount.incomingSecure,
      incomingUsername: mailAccount.incomingUsername,
      incomingPassword: mailAccount.incomingPassword,
      authType: mailAccount.authType,
    })
    .from(attachment)
    .innerJoin(message, eq(attachment.messageId, message.id))
    .innerJoin(mailAccount, eq(message.accountId, mailAccount.id))
    .where(and(
      eq(attachment.id, attachmentId),
      eq(attachment.teamId, teamId),
      eq(message.teamId, teamId),
      eq(mailAccount.teamId, teamId),
    ))
    .limit(1)

  if (!record) return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
  if (record.messageUid == null || !record.folderPath) {
    return NextResponse.json({ error: "This attachment is no longer available from the mail server" }, { status: 410 })
  }

  const siblings = await db
    .select({ id: attachment.id })
    .from(attachment)
    .where(and(eq(attachment.teamId, teamId), eq(attachment.messageId, record.messageId)))
    .orderBy(asc(attachment.id))
  const attachmentIndex = siblings.findIndex((item) => item.id === record.id)
  if (attachmentIndex < 0) return NextResponse.json({ error: "Attachment not found" }, { status: 404 })

  try {
    const accessToken = record.authType === "oauth" ? await getValidAccessToken(record.accountId) : undefined
    const downloaded = await downloadImapAttachment(
      {
        host: record.incomingHost,
        port: record.incomingPort,
        secure: record.incomingSecure,
        username: record.incomingUsername,
        password: record.authType === "oauth" ? "" : decrypt(record.incomingPassword),
        accessToken,
      },
      record.folderPath,
      record.messageUid,
      attachmentIndex,
      {
        filename: record.filename,
        mimeType: record.mimeType,
        size: record.size,
        subject: record.subject,
        fromAddress: record.fromAddress,
      },
    )

    const safeAsciiName = downloaded.filename.replace(/[\r\n"\\]/g, "_").replace(/[^\x20-\x7e]/g, "_") || "attachment"
    const encodedName = encodeURIComponent(downloaded.filename).replace(/[!'()*]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    return new Response(new Uint8Array(downloaded.content), {
      status: 200,
      headers: {
        "Content-Type": downloaded.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(downloaded.content.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Attachment retrieval failed", {
      attachmentId,
      message: error instanceof Error ? error.message : "Unknown error",
    })
    return NextResponse.json({ error: "Could not retrieve this attachment from the mail server" }, { status: 502 })
  }
}
