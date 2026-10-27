import type { BillingGateway, PlanId, CheckoutResult } from "./types"
import { OfflineGateway } from "./gateways/offline"

export type { BillingGateway, PlanId, CheckoutResult }

let _gateway: BillingGateway | null = null

export function getBillingGateway(): BillingGateway {
  if (_gateway) return _gateway

  const provider = process.env.BILLING_PROVIDER ?? "offline"

  switch (provider) {
    case "stripe":
      throw new Error("Stripe gateway not yet configured. Set BILLING_PROVIDER=offline to use the default gateway.")
    default:
      _gateway = new OfflineGateway()
      return _gateway
  }
}
