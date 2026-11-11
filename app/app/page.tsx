import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { needsOnboarding } from "@/app/actions/onboarding"
import { MailDashboard } from "@/components/mail/mail-dashboard"
import { getCurrentTeam } from "@/lib/team"

export default async function AppPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in?redirectTo=%2Fapp")

  await getCurrentTeam(session.user.id)
  const onboarding = await needsOnboarding()

  return <MailDashboard user={{ name: session.user.name, email: session.user.email }} needsOnboarding={onboarding} />
}
