import type { PlanDef } from "./types"

export const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    currency: "usd",
    interval: "month",
    limits: {
      maxAccounts: 2,
      maxMembers: 1,
      messageHistoryDays: 7,
      maxCustomFolders: 5,
      features: ["basic-search", "unified-inbox"],
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: 400, // $4 per user/month in cents
    currency: "usd",
    interval: "month",
    limits: {
      maxAccounts: "unlimited",
      maxMembers: 1,
      messageHistoryDays: "unlimited",
      maxCustomFolders: "unlimited",
      features: ["basic-search", "advanced-search", "unified-inbox", "ai-summary", "ai-writing", "smart-folders", "snooze", "signatures", "labels", "full-history"],
    },
  },
  {
    id: "team",
    name: "Team",
    price: 600, // $6 per user/month in cents
    currency: "usd",
    interval: "month",
    limits: {
      maxAccounts: "unlimited",
      maxMembers: "unlimited",
      messageHistoryDays: "unlimited",
      maxCustomFolders: "unlimited",
      features: ["basic-search", "advanced-search", "unified-inbox", "ai-summary", "ai-writing", "smart-folders", "snooze", "signatures", "labels", "full-history", "shared-inbox", "internal-comments", "assignments", "shared-drafts", "activity-feed"],
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 0, // custom pricing
    currency: "usd",
    interval: "month",
    limits: {
      maxAccounts: "unlimited",
      maxMembers: "unlimited",
      messageHistoryDays: "unlimited",
      maxCustomFolders: "unlimited",
      features: ["basic-search", "advanced-search", "unified-inbox", "ai-summary", "ai-writing", "smart-folders", "snooze", "signatures", "labels", "full-history", "shared-inbox", "internal-comments", "assignments", "shared-drafts", "activity-feed", "sso", "audit-logs", "data-retention", "custom-branding", "api", "webhooks", "dedicated-support"],
    },
  },
]

export function getPlan(id: string): PlanDef {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]
}

export function getPlanLimits(id: string) {
  return getPlan(id).limits
}
