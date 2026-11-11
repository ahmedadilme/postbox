import "server-only"
import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import nodemailer from "nodemailer"
import type { FolderType } from "./types"
import { parseMessageContent } from "./message-content"

// ---------------------------------------------------------------------------
// IMAP / SMTP mail provider
//
// Replaces the old mock with real IMAP sync (via imapflow) and real SMTP
// delivery (via nodemailer). All credentials are expected to be already
// decrypted before reaching this module.
// ---------------------------------------------------------------------------

export interface SyncFolder {
  path: string
  folderType: FolderType
}

export interface SyncedMessage {
  messageUid: number
  folderPath: string
  folderType: FolderType
  fromName: string
  fromAddress: string
  toAddresses: string
  ccAddresses: string
  subject: string
  body: string
  htmlBody: string | null
  isRead: boolean
  isStarred: boolean
  isFlagged: boolean
  hasAttachments: boolean
  receivedAt: Date
  attachments: { filename: string; mimeType: string; size: number }[]
}

export interface SendInput {
  from: { name: string; address: string }
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  htmlBody?: string
  attachments?: { filename: string; content: Buffer; mimeType: string; cid?: string; contentDisposition?: "inline" | "attachment" }[]
}

export interface ImapCredentials {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  accessToken?: string
}

export type ImapMessageOperation =
  | { type: "read" | "star" | "flag"; enabled: boolean }
  | { type: "move"; destination: FolderType }
  | { type: "delete" }

export interface ImapMessageOperationResult {
  destinationPath?: string
  uidMap?: Map<number, number>
}

export interface SmtpCredentials {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  accessToken?: string
}

// Maps our folder types to typical IMAP folder paths.
const FOLDER_MAP: Record<FolderType, string[]> = {
  inbox: ["INBOX"],
  sent: ["Sent", "Sent Items", "[Gmail]/Sent Mail"],
  drafts: ["Drafts", "[Gmail]/Drafts"],
  spam: ["Spam", "Junk", "Junk Email", "Junk E-mail", "Bulk Mail", "[Gmail]/Spam", "[Google Mail]/Spam"],
  archive: ["Archive", "[Gmail]/All Mail", "All Mail"],
  trash: ["Trash", "Deleted Items", "[Gmail]/Trash"],
}

function discoverFolderPath(mailboxes: Awaited<ReturnType<ImapFlow["list"]>>, folderType: FolderType): string | null {
  const selectableMailboxes = mailboxes.filter((mailbox) => !mailbox.flags?.has("\\Noselect"))
  const specialUse: Partial<Record<FolderType, string[]>> = {
    sent: ["\\Sent"],
    drafts: ["\\Drafts"],
    spam: ["\\Junk"],
    archive: ["\\Archive", "\\All"],
    trash: ["\\Trash"],
  }
  if (folderType === "inbox") {
    return selectableMailboxes.find((mailbox) => mailbox.path.toLowerCase() === "inbox")?.path ?? null
  }

  const bySpecialUse = selectableMailboxes.find((mailbox) =>
    specialUse[folderType]?.some((flag) => mailbox.specialUse?.toLowerCase() === flag.toLowerCase()),
  )
  if (bySpecialUse) return bySpecialUse.path

  const candidates = FOLDER_MAP[folderType].map((path) => path.toLowerCase())
  return selectableMailboxes.find((mailbox) => candidates.includes(mailbox.path.toLowerCase()))?.path ?? null
}

/** Apply one mailbox operation to a batch of IMAP UIDs. */
export async function updateImapMessages(
  imap: ImapCredentials,
  folderPath: string,
  uids: number[],
  operation: ImapMessageOperation,
): Promise<ImapMessageOperationResult> {
  const uniqueUids = [...new Set(uids.filter((uid) => Number.isInteger(uid) && uid > 0))]
  if (!uniqueUids.length) return {}

  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: imap.accessToken
      ? { user: imap.username, accessToken: imap.accessToken }
      : { user: imap.username, pass: imap.password },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })

  let connected = false
  try {
    await client.connect()
    connected = true
    const lock = await client.getMailboxLock(folderPath)
    try {
      if (operation.type === "read" || operation.type === "star" || operation.type === "flag") {
        const flag = operation.type === "read"
          ? "\\Seen"
          : operation.type === "star"
            ? "\\Flagged"
            : "$PostboxFlagged"
        const mailbox = client.mailbox
        if (operation.type === "flag" && mailbox && mailbox.permanentFlags?.has("\\*") === false) {
          // A separate app flag has no standard IMAP system flag equivalent.
          // Keep it locally when this mailbox cannot store custom keywords.
          return {}
        }
        const changed = operation.enabled
          ? await client.messageFlagsAdd(uniqueUids, [flag], { uid: true })
          : await client.messageFlagsRemove(uniqueUids, [flag], { uid: true })
        if (!changed) throw new Error("The mail server did not update the message flags")
        return {}
      }

      if (operation.type === "delete") {
        const deleted = await client.messageDelete(uniqueUids, { uid: true })
        if (!deleted) throw new Error("The mail server did not delete the selected messages")
        return {}
      }

      if (operation.type !== "move") throw new Error("Unsupported mail server operation")

      const mailboxes = await client.list()
      const destinationPath = discoverFolderPath(mailboxes, operation.destination)
      if (!destinationPath) {
        throw new Error(`Could not find the ${operation.destination} folder on the mail server`)
      }
      if (destinationPath === folderPath) return { destinationPath }

      const moved = await client.messageMove(uniqueUids, destinationPath, { uid: true })
      if (!moved) throw new Error("The mail server did not move the selected messages")
      return { destinationPath, uidMap: moved.uidMap }
    } finally {
      lock.release()
    }
  } finally {
    if (connected) {
      try {
        await client.logout()
      } catch {
        client.close()
      }
    } else {
      client.close()
    }
  }
}

export async function downloadImapAttachment(
  imap: ImapCredentials,
  folderPath: string,
  uid: number,
  attachmentIndex: number,
  expected: { filename: string; mimeType: string; size: number; subject: string; fromAddress: string },
): Promise<{ filename: string; mimeType: string; content: Buffer }> {
  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: imap.accessToken
      ? { user: imap.username, accessToken: imap.accessToken }
      : { user: imap.username, pass: imap.password },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })

  let connected = false
  try {
    await client.connect()
    connected = true
    const lock = await client.getMailboxLock(folderPath)
    try {
      const fetched = await client.fetchOne(String(uid), { source: true }, { uid: true })
      if (!fetched || !fetched.source) throw new Error("The original message is no longer available on the mail server")

      const parsed = await simpleParser(fetched.source)
      const parsedFrom = parsed.from?.value.map((address) => address.address || "").filter(Boolean).join(", ") || ""
      if (
        (expected.subject && parsed.subject?.trim() !== expected.subject.trim()) ||
        (expected.fromAddress && parsedFrom.toLowerCase() !== expected.fromAddress.toLowerCase())
      ) {
        throw new Error("The message identifier no longer matches the saved email")
      }
      const indexed = parsed.attachments[attachmentIndex]
      const selected = indexed && indexed.filename === expected.filename
        ? indexed
        : parsed.attachments.find((item) =>
            (item.filename || "attachment") === expected.filename &&
            item.contentType === expected.mimeType &&
            item.size === expected.size,
          )
      if (!selected) throw new Error("The attachment could not be found in the original message")

      return {
        filename: selected.filename || expected.filename,
        mimeType: selected.contentType || expected.mimeType,
        content: selected.content,
      }
    } finally {
      lock.release()
    }
  } finally {
    if (connected) {
      try {
        await client.logout()
      } catch {
        client.close()
      }
    } else {
      client.close()
    }
  }
}

function parseAddresses(field: unknown): string {
  if (!field) return ""
  if (typeof field === "string") return field
  if (Array.isArray(field)) {
    return field
      .map((a: { name?: string; address?: string }) => a.address || "")
      .filter(Boolean)
      .join(", ")
  }
  return ""
}

function parseName(field: unknown, fallback: string): string {
  if (!field) return fallback
  if (typeof field === "string") return field
  if (Array.isArray(field) && field.length > 0) {
    return field[0]?.name || field[0]?.address || fallback
  }
  return fallback
}

// ---------------------------------------------------------------------------
// Connection test — opens real IMAP + SMTP sockets to verify credentials
// ---------------------------------------------------------------------------
export async function testConnection(input: {
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
}): Promise<{ ok: boolean; message: string }> {
  let client: ImapFlow | null = null
  try {
    // Test IMAP
    client = new ImapFlow({
      host: input.incomingHost,
      port: input.incomingPort,
      secure: input.incomingSecure,
      auth: { user: input.incomingUsername, pass: input.incomingPassword },
      logger: false,
      verifyOnly: true,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
    })
    await client.connect()

    // Test SMTP
    const smtpTransport = nodemailer.createTransport({
      host: input.smtpHost,
      port: input.smtpPort,
      secure: input.smtpSecure,
      auth: { user: input.smtpUsername, pass: input.smtpPassword },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 15_000,
    })
    try {
      await smtpTransport.verify()
    } finally {
      smtpTransport.close()
    }

    return { ok: true, message: "Connection successful. Server settings verified." }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { ok: false, message: `Connection failed: ${msg}` }
  } finally {
    if (client) {
      try {
        await client.logout()
      } catch {
        // ignore
      }
    }
  }
}

// ---------------------------------------------------------------------------
// IMAP sync — fetches messages from a given folder
// ---------------------------------------------------------------------------
export async function syncFolder(
  imap: ImapCredentials,
  folderType: FolderType,
  sinceUid?: number,
): Promise<SyncedMessage[]> {
  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: imap.accessToken
      ? { user: imap.username, accessToken: imap.accessToken }
      : { user: imap.username, pass: imap.password },
    logger: false,
  })

  let connected = false
  try {
    await client.connect()
    connected = true
    const folderPath = discoverFolderPath(await client.list(), folderType)
    if (!folderPath) return []

    const lock = await client.getMailboxLock(folderPath)
    try {
      const fetchOpts = { uid: true, flags: true, envelope: true, bodyStructure: true, source: true }
      const lastUid = (client.mailbox && client.mailbox.uidNext - 1) || 0
      const firstUid = sinceUid ? sinceUid + 1 : 1
      const fetchIter = firstUid <= lastUid
        ? client.fetch(`${firstUid}:${lastUid}`, fetchOpts, { uid: true })
        : null

      const messages: SyncedMessage[] = []
      if (fetchIter) for await (const msg of fetchIter) {
        const env = msg.envelope
        if (!env) continue
        const content = msg.source
          ? await parseMessageContent(msg.source)
          : { text: "", html: null, attachments: [] }
        const attachmentsList = content.attachments

        const flags = msg.flags ?? new Set<string>()
        const from = env.from as { name?: string; address?: string }[] | undefined
        const to = env.to as { name?: string; address?: string }[] | undefined
        const cc = env.cc as { name?: string; address?: string }[] | undefined
        const sender = env.sender as { name?: string; address?: string }[] | undefined

        messages.push({
          messageUid: msg.uid,
          folderPath,
          folderType,
          fromName: parseName(from, sender?.[0]?.address || "Unknown"),
          fromAddress: parseAddresses(from),
          toAddresses: parseAddresses(to),
          ccAddresses: parseAddresses(cc),
          subject: env.subject || "(no subject)",
          body: content.text,
          htmlBody: content.html,
          isRead: flags.has("\\Seen"),
          isStarred: flags.has("\\Flagged"),
          isFlagged: flags.has("$PostboxFlagged"),
          hasAttachments: attachmentsList.length > 0,
          receivedAt: env.date || new Date(),
          attachments: attachmentsList,
        })
      }

      return messages
    } finally {
      lock.release()
    }
  } finally {
    if (connected) {
      try {
        await client.logout()
      } catch {
        client.close()
      }
    } else {
      client.close()
    }
  }
}

// ---------------------------------------------------------------------------
// Full sync across all folders
// ---------------------------------------------------------------------------
export async function syncAllFolders(
  imap: ImapCredentials,
  existingUids: { folderPath: string; minUid?: number; maxUid: number }[],
): Promise<SyncedMessage[]> {
  const all: SyncedMessage[] = []
  const folderTypes: FolderType[] = ["inbox", "sent", "drafts", "spam", "archive", "trash"]
  // A first sync should show recent mail quickly instead of downloading an
  // entire multi-year mailbox (including every full RFC822 source) in one run.
  const initialSyncUidWindow = 500

  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: imap.accessToken
      ? { user: imap.username, accessToken: imap.accessToken }
      : { user: imap.username, pass: imap.password },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })

  let connected = false
  try {
    await client.connect()
    connected = true
    const mailboxes = await client.list()

    for (const folderType of folderTypes) {
      const folderPath = discoverFolderPath(mailboxes, folderType)
      if (!folderPath) continue
      const existing = existingUids.find((e) => e.folderPath === folderPath)
      const sinceUid = existing?.maxUid

      try {
        const lock = await client.getMailboxLock(folderPath)
        try {
          const mailbox = client.mailbox
          const lastUid = (mailbox && mailbox.uidNext - 1) || 0
          const firstUid = Math.max(1, lastUid - initialSyncUidWindow + 1)
          const fetchRanges = existing
            ? [
                ...(existing.minUid && existing.minUid > 1
                  ? [[Math.max(1, existing.minUid - initialSyncUidWindow), existing.minUid - 1] as const]
                  : []),
                [sinceUid! + 1, lastUid] as const,
              ]
            : [[firstUid, lastUid] as const]

          for (const [rangeStart, rangeEnd] of fetchRanges) {
            if (rangeStart > rangeEnd) continue
            const range = `${rangeStart}:${rangeEnd}`
            const fetchIter = client.fetch(range, {
              uid: true,
              flags: true,
              envelope: true,
              bodyStructure: true,
              source: true,
            }, { uid: true })

            for await (const msg of fetchIter) {
              const env = msg.envelope
              if (!env) continue
              const content = msg.source
                ? await parseMessageContent(msg.source)
                : { text: "", html: null, attachments: [] }
              const attachmentsList = content.attachments

              const flags = msg.flags ?? new Set<string>()
              const from = env.from as { name?: string; address?: string }[] | undefined
              const to = env.to as { name?: string; address?: string }[] | undefined
              const cc = env.cc as { name?: string; address?: string }[] | undefined
              const sender = env.sender as { name?: string; address?: string }[] | undefined

              all.push({
                messageUid: msg.uid,
                folderPath,
                folderType,
                fromName: parseName(from, sender?.[0]?.address || "Unknown"),
                fromAddress: parseAddresses(from),
                toAddresses: parseAddresses(to),
                ccAddresses: parseAddresses(cc),
                subject: env.subject || "(no subject)",
                body: content.text,
                htmlBody: content.html,
                isRead: flags.has("\\Seen"),
                isStarred: flags.has("\\Flagged"),
                isFlagged: flags.has("$PostboxFlagged"),
                hasAttachments: attachmentsList.length > 0,
                receivedAt: env.date || new Date(),
                attachments: attachmentsList,
              })
            }
          }
        } finally {
          lock.release()
        }
      } catch (err) {
        if (folderType === "inbox") throw err
        console.warn(`IMAP sync skipped the ${folderType} folder`, err instanceof Error ? err.message : err)
      }
    }
  } finally {
    if (connected) {
      try {
        await client.logout()
      } catch (err) {
        console.warn("IMAP logout failed after sync", err instanceof Error ? err.message : err)
        client.close()
      }
    } else {
      client.close()
    }
  }

  return all
}

// ---------------------------------------------------------------------------
// SMTP send — delivers email via the account's SMTP server
// ---------------------------------------------------------------------------
export async function sendEmail(
  smtp: SmtpCredentials,
  input: SendInput,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.accessToken
      ? { type: "OAuth2", user: smtp.username, accessToken: smtp.accessToken }
      : { user: smtp.username, pass: smtp.password },
  })

  try {
    const info = await transporter.sendMail({
      from: `"${input.from.name}" <${input.from.address}>`,
      to: input.to.join(", "),
      cc: input.cc?.join(", "),
      bcc: input.bcc?.join(", "),
      subject: input.subject,
      text: input.body,
      html: input.htmlBody,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.mimeType,
        cid: a.cid,
        contentDisposition: a.contentDisposition,
      })),
    })

    return { ok: true, messageId: info.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown SMTP error"
    return { ok: false, error: msg }
  }
}
