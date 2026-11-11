import "server-only"

const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"

export async function refreshMicrosoftToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) throw new Error(`Microsoft token refresh failed: ${await res.text()}`)
  return res.json()
}
