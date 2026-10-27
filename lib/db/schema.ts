import { pgTable, text, timestamp, boolean, serial, integer, uuid, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Better Auth tables (column names must stay camelCase to match defaults)
// ---------------------------------------------------------------------------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// ---------------------------------------------------------------------------
// SaaS multi-tenancy tables
// ---------------------------------------------------------------------------
export const team = pgTable("team", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripeCustomerId"),
  stripeSubscriptionId: text("stripeSubscriptionId"),
  suspended: boolean("suspended").notNull().default(false),
  suspendedAt: timestamp("suspendedAt"),
  suspensionReason: text("suspensionReason"),
  featureOverrides: jsonb("featureOverrides").notNull().default("{}"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const teamMember = pgTable("team_member", {
  id: serial("id").primaryKey(),
  teamId: uuid("teamId")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joinedAt").notNull().defaultNow(),
})

export const invitation = pgTable("invitation", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("teamId")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  adminId: text("adminId").notNull(),
  action: text("action").notNull(),
  targetType: text("targetType").notNull(),
  targetId: text("targetId").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const teamAuditLog = pgTable("team_audit_log", {
  id: serial("id").primaryKey(),
  teamId: uuid("teamId").notNull().references(() => team.id, { onDelete: "cascade" }),
  actorId: text("actorId").notNull().references(() => user.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  targetType: text("targetType").notNull(),
  targetId: text("targetId").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => [index("team_audit_log_team_created_idx").on(table.teamId, table.createdAt)])

// ---------------------------------------------------------------------------
// App tables (scoped per team via teamId)
// ---------------------------------------------------------------------------
export const mailAccount = pgTable("mail_account", {
  id: serial("id").primaryKey(),
  teamId: uuid("teamId")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  userId: text("userId").notNull(),
  displayName: text("displayName").notNull(),
  emailAddress: text("emailAddress").notNull(),
  color: text("color").notNull().default("#2563eb"),
  incomingProtocol: text("incomingProtocol").notNull().default("imap"),
  incomingHost: text("incomingHost").notNull(),
  incomingPort: integer("incomingPort").notNull().default(993),
  incomingSecure: boolean("incomingSecure").notNull().default(true),
  incomingUsername: text("incomingUsername").notNull(),
  incomingPassword: text("incomingPassword").notNull(),
  smtpHost: text("smtpHost").notNull(),
  smtpPort: integer("smtpPort").notNull().default(465),
  smtpSecure: boolean("smtpSecure").notNull().default(true),
  smtpUsername: text("smtpUsername").notNull(),
  smtpPassword: text("smtpPassword").notNull(),
   signature: text("signature").notNull().default(""),
   defaultSignatureId: integer("defaultSignatureId"),
   authType: text("authType").notNull().default("password"),
  oauthProvider: text("oauthProvider"),
  oauthRefreshToken: text("oauthRefreshToken"),
  oauthAccessToken: text("oauthAccessToken"),
  oauthTokenExpiresAt: timestamp("oauthTokenExpiresAt"),
  syncStatus: text("syncStatus").notNull().default("idle"),
  lastSyncAt: timestamp("lastSyncAt"),
  syncAttemptAt: timestamp("syncAttemptAt"),
  syncError: text("syncError"),
   createdAt: timestamp("createdAt").notNull().defaultNow(),
 })
 
 export const mailSignature = pgTable("mail_signature", {
   id: serial("id").primaryKey(),
   teamId: uuid("teamId")
     .notNull()
     .references(() => team.id, { onDelete: "cascade" }),
   userId: text("userId").notNull(),
   accountId: integer("accountId").notNull(),
   name: text("name").notNull(),
   body: text("body").notNull().default(""),
   isDefault: boolean("isDefault").notNull().default(false),
   createdAt: timestamp("createdAt").notNull().defaultNow(),
   updatedAt: timestamp("updatedAt").notNull().defaultNow(),
 })
 
 export const folder = pgTable("folder", {
  id: serial("id").primaryKey(),
  teamId: uuid("teamId")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  userId: text("userId").notNull(),
  accountId: integer("accountId").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("custom"),
  sortOrder: integer("sortOrder").notNull().default(0),
})

export const message = pgTable("message", {
  id: serial("id").primaryKey(),
  teamId: uuid("teamId")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  userId: text("userId").notNull(),
  accountId: integer("accountId").notNull(),
  folderType: text("folderType").notNull().default("inbox"),
  messageUid: integer("messageUid"),
  folderPath: text("folderPath"),
  searchVector: text("searchVector"),
  fromName: text("fromName").notNull(),
  fromAddress: text("fromAddress").notNull(),
  toAddresses: text("toAddresses").notNull().default(""),
  ccAddresses: text("ccAddresses").notNull().default(""),
  subject: text("subject").notNull().default(""),
  preview: text("preview").notNull().default(""),
  body: text("body").notNull().default(""),
  htmlBody: text("htmlBody"),
  isRead: boolean("isRead").notNull().default(false),
  isStarred: boolean("isStarred").notNull().default(false),
  isFlagged: boolean("isFlagged").notNull().default(false),
  hasAttachments: boolean("hasAttachments").notNull().default(false),
  snoozedUntil: timestamp("snoozedUntil"),
  draftShared: boolean("draftShared").notNull().default(false),
  draftRevision: integer("draftRevision").notNull().default(1),
  receivedAt: timestamp("receivedAt").notNull().defaultNow(),
}, (table) => [index("message_team_shared_drafts_idx").on(table.teamId, table.folderType, table.draftShared, table.userId)])

// SMTP sends are staged here briefly so the sender can undo delivery. The
// payload is cleared as soon as a message is sent, cancelled, or fails.
export const outgoingQueue = pgTable("outgoing_queue", {
  id: serial("id").primaryKey(),
  teamId: uuid("teamId").notNull().references(() => team.id, { onDelete: "cascade" }),
  userId: text("userId").notNull(),
  accountId: integer("accountId").notNull().references(() => mailAccount.id, { onDelete: "cascade" }),
  payload: jsonb("payload"),
  status: text("status").notNull().default("queued"),
  scheduledAt: timestamp("scheduledAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  errorMessage: text("errorMessage"),
})

export const label = pgTable("label", {
  id: serial("id").primaryKey(),
  teamId: uuid("teamId")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  userId: text("userId").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const messageLabel = pgTable("message_label", {
  id: serial("id").primaryKey(),
  messageId: integer("messageId").notNull(),
  labelId: integer("labelId").notNull(),
}, (table) => [uniqueIndex("message_label_pair_unique").on(table.messageId, table.labelId)])

export const messageComment = pgTable("message_comment", {
  id: serial("id").primaryKey(),
  teamId: uuid("teamId").notNull().references(() => team.id, { onDelete: "cascade" }),
  messageId: integer("messageId").notNull().references(() => message.id, { onDelete: "cascade" }),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const messageAssignment = pgTable("message_assignment", {
  id: serial("id").primaryKey(),
  teamId: uuid("teamId").notNull().references(() => team.id, { onDelete: "cascade" }),
  messageId: integer("messageId").notNull().references(() => message.id, { onDelete: "cascade" }),
  assignedTo: text("assignedTo").notNull().references(() => user.id, { onDelete: "cascade" }),
  assignedBy: text("assignedBy").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (table) => [uniqueIndex("message_assignment_message_unique").on(table.messageId)])

export const messageActivity = pgTable("message_activity", {
  id: serial("id").primaryKey(),
  teamId: uuid("teamId").notNull().references(() => team.id, { onDelete: "cascade" }),
  messageId: integer("messageId").notNull().references(() => message.id, { onDelete: "cascade" }),
  actorId: text("actorId").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => [index("message_activity_team_message_created_idx").on(table.teamId, table.messageId, table.createdAt)])

export const attachment = pgTable("attachment", {
  id: serial("id").primaryKey(),
  teamId: uuid("teamId")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  userId: text("userId").notNull(),
  messageId: integer("messageId").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mimeType").notNull().default("application/octet-stream"),
  size: integer("size").notNull().default(0),
})
