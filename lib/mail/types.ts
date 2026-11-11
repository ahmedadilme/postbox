// Shared types for the mail dashboard. These mirror the Drizzle schema rows but
// are the contract the UI depends on, so a real IMAP/SMTP provider can later
// produce the same shapes without any UI changes.

export type FolderType = "inbox" | "sent" | "drafts" | "trash" | "archive" | "spam"

export type IncomingProtocol = "imap" | "pop3"

export interface MailAccount {
  id: number
  displayName: string
  emailAddress: string
  color: string
  incomingProtocol: IncomingProtocol
  incomingHost: string
  incomingPort: number
  incomingSecure: boolean
  incomingUsername: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUsername: string
  signature: string
  signatures: MailSignature[]
  defaultSignatureId: number | null
  authType: "password" | "oauth"
  oauthProvider: string | null
  syncStatus: "idle" | "syncing" | "error"
  lastSyncAt: string | null
  syncAttemptAt: string | null
  syncError: string | null
  createdAt: string
}

export interface MailSignature {
  id: number
  accountId: number
  name: string
  body: string
  isDefault: boolean
}

export interface Attachment {
  id: number
  filename: string
  mimeType: string
  size: number
}

export interface MailLabel {
  id: number
  name: string
  color: string
}

export interface MailMessage {
  id: number
  accountId: number
  folderType: FolderType
  fromName: string
  fromAddress: string
  toAddresses: string
  ccAddresses: string
  subject: string
  preview: string
  body: string
  htmlBody?: string | null
  isRead: boolean
  isStarred: boolean
  isFlagged: boolean
  hasAttachments: boolean
  snoozedUntil: string | null
  draftShared?: boolean
  draftRevision?: number
  draftOwnerId?: string
  canManageDraftSharing?: boolean
  receivedAt: string
  attachments?: Attachment[]
  labels?: MailLabel[]
  assignment?: { userId: string; name: string; email: string } | null
}

export interface FolderCount {
  folderType: FolderType
  total: number
  unread: number
}

export type SmartFolderType = "starred" | "attachments" | "unread" | "snoozed" | "assigned"

export const FOLDERS: { type: FolderType; label: string }[] = [
  { type: "inbox", label: "Inbox" },
  { type: "sent", label: "Sent" },
  { type: "drafts", label: "Drafts" },
  { type: "spam", label: "Spam" },
  { type: "archive", label: "Archive" },
  { type: "trash", label: "Trash" },
]

export const SMART_FOLDERS: { type: SmartFolderType; label: string; icon: string }[] = [
  { type: "starred", label: "Starred", icon: "star" },
  { type: "attachments", label: "With Attachments", icon: "paperclip" },
  { type: "unread", label: "Unread", icon: "mail-open" },
  { type: "snoozed", label: "Snoozed", icon: "clock" },
  { type: "assigned", label: "Assigned to me", icon: "user-check" },
]

export const ACCOUNT_COLORS = ["#2563eb", "#0d9488", "#db2777", "#ea580c", "#7c3aed", "#16a34a"]
