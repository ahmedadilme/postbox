import Link from "next/link"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { PLANS } from "@/lib/billing/plans"
import { PlanRequestButton } from "@/components/pricing/plan-request-button"

const PLAN_DETAILS = [
  {
    id: "free",
    description: "Try Postbox with your everyday mail.",
    features: ["2 email accounts", "5 custom folders", "7-day message history", "Unified inbox and search"],
    action: "Start free",
  },
  {
    id: "pro",
    description: "More room and history for a growing business owner.",
    features: ["1 team member", "Unlimited email accounts and history", "Unlimited custom folders", "Advanced search, labels, snooze, and signatures"],
  },
  {
    id: "team",
    description: "Shared mail and collaboration for small teams.",
    features: ["Unlimited members, accounts, and history", "Shared drafts and internal comments", "Assignments and team activity history"],
  },
] as const

export default async function PricingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const signedIn = Boolean(session?.user)

  return (
    <div className="min-h-svh bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-foreground">Postbox</Link>
        <Link href={signedIn ? "/settings" : "/sign-in"} className="text-sm text-muted-foreground hover:text-foreground">
          {signedIn ? "Account settings" : "Sign in"}
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Simple pricing for small teams</h1>
          <p className="mt-3 text-lg text-muted-foreground">Start free. Add affordable capacity as your business grows.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {PLAN_DETAILS.map((details) => {
            const plan = PLANS.find((item) => item.id === details.id)!
            const featured = plan.id === "team"
            return (
              <article key={plan.id} className={`flex flex-col rounded-xl border p-6 ${featured ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card"}`}>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">${plan.price === 0 ? "0" : (plan.price / 100).toFixed(0)}</span>
                    <span className="text-sm text-muted-foreground">{plan.price === 0 ? "forever" : plan.id === "team" ? "/ member / month" : "/ month"}</span>
                  </div>
                  <p className="mt-3 min-h-10 text-sm text-muted-foreground">{details.description}</p>
                </div>
                <ul className="my-6 flex-1 space-y-3">
                  {details.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-0.5 text-primary">✓</span>{feature}
                    </li>
                  ))}
                </ul>
                {plan.id === "free" ? (
                  <Link href={signedIn ? "/" : "/sign-up"} className="flex h-10 w-full items-center justify-center rounded-md border border-border text-sm font-medium text-foreground hover:bg-accent">
                    {signedIn ? "Go to Postbox" : "Start free"}
                  </Link>
                ) : (
                  <PlanRequestButton planId={plan.id} signedIn={signedIn} />
                )}
              </article>
            )
          })}
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-muted-foreground">
          During early access, paid plans are activated by request. Postbox does not collect payment yet, and submitting a request does not charge you.
        </p>
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Connected mail is synced to the service. Account credentials are encrypted at rest.{' '}
          <Link href={signedIn ? "/settings" : "/sign-up"} className="text-primary hover:underline">Get started</Link>
        </p>
      </section>
    </div>
  )
}
