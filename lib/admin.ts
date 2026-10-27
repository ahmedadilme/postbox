import "server-only"
import { getSessionUser, type SessionUser } from "@/lib/team"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/db/schema"

export function isAdminEmail(email: string): boolean {
  const admins = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) ?? []
  return admins.length > 0 && admins.includes(email.toLowerCase())
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!isAdminEmail(user.email)) throw new Error("Forbidden: admin access required")
  return user
}

export function isAdminFromSession(user: { email: string }): boolean {
  return isAdminEmail(user.email)
}

export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(auditLog).values({
    adminId,
    action,
    targetType,
    targetId,
    metadata: metadata ?? {},
  })
}
