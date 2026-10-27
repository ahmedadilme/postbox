"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { acceptInvitation } from "@/app/actions/team"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/app-error"

export function InvitationAcceptance({
  token,
  invitedEmail,
  currentEmail,
}: {
  token: string
  invitedEmail: string
  currentEmail: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const accountMatches = currentEmail.toLowerCase() === invitedEmail.toLowerCase()

  async function handleAccept() {
    setLoading(true)
    setError("")
    try {
      await acceptInvitation(token)
      router.replace("/")
      router.refresh()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function switchAccount() {
    await authClient.signOut()
    const destination = `/invite/${token}`
    router.replace(`/sign-in?redirectTo=${encodeURIComponent(destination)}&email=${encodeURIComponent(invitedEmail)}`)
  }

  return (
    <div className="mt-5 space-y-3">
      {accountMatches ? (
        <Button onClick={handleAccept} disabled={loading} className="w-full">
          {loading ? "Accepting invitation…" : "Accept invitation"}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            You are signed in as {currentEmail}. This invitation is for {invitedEmail}.
          </p>
          <Button variant="outline" onClick={switchAccount} className="w-full">
            Switch to invited account
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
