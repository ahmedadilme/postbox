import { betterAuth } from "better-auth"
import { randomBytes } from "node:crypto"
import { pool } from "@/lib/db"

const authSecret = process.env.BETTER_AUTH_SECRET ??
  (process.env.NODE_ENV === "development" ? randomBytes(32).toString("base64url") : undefined)

if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET must be configured before starting the application")
}

export const auth = betterAuth({
  database: pool,
  secret: authSecret,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL
          ? `https://${process.env.V0_RUNTIME_URL}`
          : "http://localhost:3000"),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: [
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
    // v0 preview iframe is served from a rotating *.vusercontent.net subdomain
    "https://*.vusercontent.net",
    // Vercel preview/production deployments
    "https://*.vercel.app",
    ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000", "http://127.0.0.1:3000"] : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: {
          // In dev (v0 preview iframe), force cross-site cookies so the
          // session cookie is stored by the browser.
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
})
