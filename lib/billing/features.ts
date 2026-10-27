import { getPlanLimits, getPlan } from "./plans"
import type { PlanLimits } from "./types"

export interface ResourceUsage {
  allowed: number | "unlimited"
  current: number
  remaining: string
}

/**
 * Check whether a plan has a given feature flag.
 */
export function hasFeature(planId: string, feature: string): boolean {
  return getPlan(planId).limits.features.includes(feature)
}

/**
 * Check whether a resource is within the plan's limits.
 */
export function checkLimit(
  planId: string,
  resource: keyof PlanLimits,
  currentCount: number,
): ResourceUsage {
  const limits = getPlanLimits(planId)
  const allowed = limits[resource]

  if (allowed === "unlimited") {
    return { allowed: "unlimited", current: currentCount, remaining: "unlimited" }
  }

  const numericAllowed = allowed as number
  const remaining = Math.max(0, numericAllowed - currentCount)

  return {
    allowed: numericAllowed,
    current: currentCount,
    remaining: remaining === 0
      ? "Limit reached"
      : remaining === 1
        ? "1 remaining"
        : `${remaining} remaining`,
  }
}

/**
 * Human-readable summary of a plan's capabilities.
 */
export function getPlanSummary(planId: string): string[] {
  const limits = getPlanLimits(planId)
  const lines: string[] = []

  lines.push(`Accounts: ${limits.maxAccounts === "unlimited" ? "Unlimited" : limits.maxAccounts}`)
  lines.push(`Team members: ${limits.maxMembers === "unlimited" ? "Unlimited" : limits.maxMembers}`)
  lines.push(`History: ${limits.messageHistoryDays === "unlimited" ? "Full" : `${limits.messageHistoryDays} days`}`)
  lines.push(`Folders: ${limits.maxCustomFolders === "unlimited" ? "Unlimited" : limits.maxCustomFolders}`)

  return lines
}
