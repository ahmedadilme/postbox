import type { BillingGateway, PlanId, CheckoutResult } from "../types"
import { db } from "@/lib/db"
import { team } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export class OfflineGateway implements BillingGateway {
  name = "offline"

  async createCheckout(teamId: string, planId: PlanId, successUrl: string, cancelUrl?: string): Promise<CheckoutResult> {
    // For offline/manual mode, directly upgrade the team plan
    await db.update(team).set({ plan: planId }).where(eq(team.id, teamId))
    return { url: successUrl }
  }

  async getPortalUrl(): Promise<{ url: string }> {
    return { url: "/settings" }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    // Nothing to cancel in offline mode
  }

  async handleWebhook(): Promise<void> {
    // Nothing to handle in offline mode
  }
}
