export type PlanId = "free" | "pro" | "team" | "enterprise"

export interface PlanLimits {
  maxAccounts: number | "unlimited"
  maxMembers: number | "unlimited"
  messageHistoryDays: number | "unlimited"
  maxCustomFolders: number | "unlimited"
  features: string[]
}

export interface PlanDef {
  id: PlanId
  name: string
  price: number
  currency: string
  interval: "month" | "year"
  limits: PlanLimits
  stripePriceId?: string
  paddlePriceId?: string
}

export interface CheckoutResult {
  url: string
}

export interface BillingGateway {
  name: string
  createCheckout(teamId: string, planId: PlanId, successUrl: string, cancelUrl?: string): Promise<CheckoutResult>
  getPortalUrl(teamId: string): Promise<{ url: string }>
  handleWebhook(payload: unknown): Promise<void>
  cancelSubscription(subscriptionId: string): Promise<void>
}
