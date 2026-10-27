"use client"

import { useState } from "react"
import { Mail, ArrowRight, Check, UserPlus, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addAccount, syncAccount, type AddAccountInput } from "@/app/actions/accounts"
import { testAccountConnection } from "@/app/actions/accounts"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface OnboardingOverlayProps {
  userName: string
  onComplete: () => void
  onSkip: () => void
  onAccountAdded: () => void
}

export function OnboardingOverlay({ userName, onComplete, onSkip, onAccountAdded }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState(userName)
  const [connecting, setConnecting] = useState(false)

  const steps = [
    {
      title: "Welcome to Postbox",
      subtitle: `Hi ${userName}! Let's get you set up in under a minute.`,
      icon: <Mail className="h-8 w-8" />,
    },
    {
      title: "Connect your email",
      subtitle: "Add your first email account to get started. We support Gmail, Outlook, Yahoo, and any IMAP provider.",
      icon: <Zap className="h-8 w-8" />,
    },
    {
      title: "You're all set!",
      subtitle: "Your inbox is ready. Start managing your email at the speed of thought.",
      icon: <Check className="h-8 w-8" />,
    },
  ]

  const current = steps[step]

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return

    setConnecting(true)
    try {
      const input: AddAccountInput = {
        displayName: displayName || email.split("@")[0],
        emailAddress: email,
        incomingProtocol: "imap",
        incomingHost: `imap.${email.split("@")[1] || "example.com"}`,
        incomingPort: 993,
        incomingSecure: true,
        incomingUsername: email,
        incomingPassword: password,
        smtpHost: `smtp.${email.split("@")[1] || "example.com"}`,
        smtpPort: 465,
        smtpSecure: true,
        smtpUsername: email,
        smtpPassword: password,
      }
      const { id } = await addAccount(input)
      toast.success(`${email} added`)
      setStep(2)
      void syncAccount(id)
        .then(() => {
          toast.success(`${email} synced`)
          onAccountAdded()
        })
        .catch((err) => {
          toast.error(`Account added, but initial sync failed: ${err instanceof Error ? err.message : "Unknown sync error"}`)
          onAccountAdded()
        })
    } catch {
      toast.error("Could not connect account. Check your credentials or skip for now.")
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`flex h-2 w-2 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
          <span className="ml-auto text-xs">Step {step + 1} of 3</span>
        </div>

        <div className="mb-6 mt-4 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {current.icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{current.title}</h2>
            <p className="text-sm text-muted-foreground">{current.subtitle}</p>
          </div>
        </div>

        {step === 0 && (
          <div className="flex flex-col gap-3">
            <Button onClick={() => setStep(1)} className="w-full">
              Let's go <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={onSkip} className="w-full text-muted-foreground">
              Skip for now
            </Button>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleConnect} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="onboard-name">Display name</Label>
              <Input
                id="onboard-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="onboard-email">Email address</Label>
              <Input
                id="onboard-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="onboard-password">Password</Label>
              <Input
                id="onboard-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="App password"
                required
              />
              <p className="text-xs text-muted-foreground">
                For Gmail, use an{' '}
                <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  App Password
                </a>. Your credentials are encrypted.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1">
                Back
              </Button>
              <Button type="submit" disabled={connecting} className="flex-1">
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Connect
              </Button>
            </div>
            <Button type="button" variant="ghost" onClick={onSkip} className="text-xs text-muted-foreground">
              Skip — I'll add an account later
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-primary/10 p-4 text-center text-sm text-primary">
              🎉 Your dashboard is ready!
            </div>
            <Button onClick={onComplete} className="w-full">
              Go to dashboard <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
