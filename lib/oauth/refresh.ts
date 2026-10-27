import "server-only"
import { db } from "@/lib/db"
import { mailAccount } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { decrypt, encrypt } from "@/lib/encryption"
import { refreshGoogleToken } from "./google"
import { refreshMicrosoftToken } from "./microsoft"

export async function getValidAccessToken(accountId: number): Promise<string> {
  const [acct] = await db
    .select()
    .from(mailAccount)
    .where(eq(mailAccount.id, accountId))

  if (!acct || acct.authType !== "oauth") {
    throw new Error("Account does not use OAuth")
  }

  const expiresAt = acct.oauthTokenExpiresAt
  const now = new Date()

  // If token is still valid (>5 min buffer), return it
  if (expiresAt && expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    return decrypt(acct.oauthAccessToken!)
  }

  // Need to refresh
  const refreshToken = decrypt(acct.oauthRefreshToken!)
  let newTokens: { access_token: string; expires_in: number }

  if (acct.oauthProvider === "google") {
    newTokens = await refreshGoogleToken(refreshToken)
  } else if (acct.oauthProvider === "microsoft") {
    newTokens = await refreshMicrosoftToken(refreshToken)
  } else {
    throw new Error(`Unknown OAuth provider: ${acct.oauthProvider}`)
  }

  const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000)

  await db
    .update(mailAccount)
    .set({
      oauthAccessToken: encrypt(newTokens.access_token),
      oauthTokenExpiresAt: newExpiry,
    })
    .where(eq(mailAccount.id, accountId))

  return newTokens.access_token
}
