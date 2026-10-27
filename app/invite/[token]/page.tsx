import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { InvitationAcceptance } from "@/components/settings/invitation-acceptance"
import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { invitation, team } from "@/lib/db/schema"

export const metadata = {
  title: "Team invitation | Postbox",
  robots: { index: false, follow: false },
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[\da-f]{64}$/i.test(token)) notFound()

  const [invite] = await db.select({
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    teamName: team.name,
  }).from(invitation)
    .innerJoin(team, eq(invitation.teamId, team.id))
    .where(eq(invitation.token, token))
    .limit(1)
  if (!invite) notFound()

  const session = await auth.api.getSession({ headers: await headers() })
  const isExpired = invite.expiresAt < new Date()
  const isAccepted = invite.acceptedAt !== null

  if (!isAccepted && !isExpired && !session?.user) {
    return (
      <AuthForm
        mode="sign-up"
        redirectTo={`/invite/${token}`}
        initialEmail={invite.email}
        title={`Join ${invite.teamName}`}
        subtitle={`Create an account with ${invite.email} to accept this invitation.`}
      />
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-lg p-6">
        <h1 className="text-xl font-semibold">Join {invite.teamName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isAccepted
            ? "This invitation has already been accepted."
            : isExpired
              ? "This invitation has expired. Ask a team admin for a new link."
              : `You were invited as ${invite.email}. The link expires ${invite.expiresAt.toLocaleDateString()}.`}
        </p>
        {!isAccepted && !isExpired && (
          session?.user ? (
            <InvitationAcceptance token={token} invitedEmail={invite.email} currentEmail={session.user.email} />
          ) : null
        )}
      </Card>
    </main>
  )
}
