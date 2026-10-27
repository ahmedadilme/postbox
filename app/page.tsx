import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getCurrentTeam } from "@/lib/team"
import { needsOnboarding } from "@/app/actions/onboarding"
import { MailDashboard } from "@/components/mail/mail-dashboard"
import { LandingPage } from "@/components/landing-page"

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return <LandingPage />

  const team = await getCurrentTeam(session.user.id)
  const onboarding = await needsOnboarding()

  return <MailDashboard user={{ name: session.user.name, email: session.user.email }} needsOnboarding={onboarding} />
}
