import { NextResponse } from "next/server"
import { getGoogleAuthUrl } from "@/lib/oauth/google"
import crypto from "node:crypto"

export async function GET() {
  const state = crypto.randomBytes(32).toString("hex")

  // Store state in a cookie for CSRF verification
  const response = NextResponse.redirect(getGoogleAuthUrl(state))
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  })

  return response
}
