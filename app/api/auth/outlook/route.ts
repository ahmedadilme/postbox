import { NextResponse } from "next/server"
import { getMicrosoftAuthUrl } from "@/lib/oauth/microsoft"
import crypto from "node:crypto"

export async function GET() {
  const state = crypto.randomBytes(32).toString("hex")

  const response = NextResponse.redirect(getMicrosoftAuthUrl(state))
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  })

  return response
}
