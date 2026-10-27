import { NextRequest, NextResponse } from "next/server"
import { exchangeGoogleCode, getGoogleEmail } from "@/lib/oauth/google"
import { encrypt } from "@/lib/encryption"
import { db } from "@/lib/db"
import { mailAccount, team, teamMember } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { ACCOUNT_COLORS } from "@/lib/mail/types"
import { checkLimit } from "@/lib/billing/features"

async function ensureTeam(userId: string) {
  const [existing] = await db
    .select({ teamId: teamMember.teamId })
    .from(teamMember)
    .innerJoin(team, eq(teamMember.teamId, team.id))
    .where(eq(teamMember.userId, userId))
    .limit(1)

  if (existing) return existing.teamId

  const [created] = await db
    .insert(team)
    .values({ name: "My Team", slug: `team-${userId.slice(0, 8)}` })
    .returning()

  await db.insert(teamMember).values({ teamId: created.id, userId, role: "admin" })
  return created.id
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  // Handle OAuth error (user denied consent)
  if (error) {
    return NextResponse.redirect(new URL("/?error=oauth_denied", req.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=oauth_missing_params", req.url))
  }

  // CSRF check
  const savedState = req.cookies.get("oauth_state")?.value
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL("/?error=oauth_state_mismatch", req.url))
  }

  try {
    const tokens = await exchangeGoogleCode(code)
    const accessToken = tokens.access_token
    const refreshToken = tokens.refresh_token

    if (!refreshToken) {
      return NextResponse.redirect(new URL("/?error=oauth_no_refresh_token", req.url))
    }

    // Get user email
    const email = await getGoogleEmail(accessToken)

    // Get current session
    const session = await auth.api.getSession({
      headers: { cookie: req.headers.get("cookie") || "" },
    })
    if (!session?.user) {
      return NextResponse.redirect(new URL("/sign-in?error=oauth_not_authenticated", req.url))
    }

    // Ensure team exists
    const teamId = await ensureTeam(session.user.id)

    // Check how many accounts the user already has
    const existing = await db
      .select({ id: mailAccount.id, emailAddress: mailAccount.emailAddress })
      .from(mailAccount)
      .where(and(eq(mailAccount.teamId, teamId), eq(mailAccount.userId, session.user.id)))

    if (existing.some((account) => account.emailAddress.toLowerCase() === email.toLowerCase())) {
      return NextResponse.redirect(new URL("/?error=oauth_account_exists", req.url))
    }

    const [currentTeam] = await db.select({ plan: team.plan }).from(team).where(eq(team.id, teamId)).limit(1)
    if (!currentTeam || checkLimit(currentTeam.plan, "maxAccounts", existing.length).remaining === "Limit reached") {
      return NextResponse.redirect(new URL("/?error=oauth_account_limit", req.url))
    }

    const color = ACCOUNT_COLORS[existing.length % ACCOUNT_COLORS.length]

    // Store the account with OAuth tokens
    await db.insert(mailAccount).values({
      teamId,
      userId: session.user.id,
      displayName: email.split("@")[0],
      emailAddress: email,
      color,
      incomingProtocol: "imap",
      incomingHost: "imap.gmail.com",
      incomingPort: 993,
      incomingSecure: true,
      incomingUsername: email,
      incomingPassword: encrypt(accessToken),
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUsername: email,
      smtpPassword: encrypt(accessToken),
      authType: "oauth",
      oauthProvider: "google",
      oauthRefreshToken: encrypt(refreshToken),
      oauthAccessToken: encrypt(accessToken),
      oauthTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    })

    return NextResponse.redirect(new URL("/?oauth=google_success", req.url))
  } catch (err) {
    console.error("Google OAuth callback error:", err)
    return NextResponse.redirect(new URL("/?error=oauth_failed", req.url))
  }
}
