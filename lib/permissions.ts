export type Role = "admin" | "member"

export type Permission =
  | "invite-member"
  | "remove-member"
  | "manage-billing"
  | "manage-team"
  | "update-settings"
  | "delete-account"
  | "manage-accounts"
  | "view-settings"

const PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "invite-member",
    "remove-member",
    "manage-billing",
    "manage-team",
    "update-settings",
    "delete-account",
    "manage-accounts",
    "view-settings",
  ],
  member: [
    "manage-accounts",
    "view-settings",
  ],
}

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false
}
