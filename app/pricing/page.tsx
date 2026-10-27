import Link from "next/link"

const FEATURES = [
  "Up to 2 email accounts",
  "Unified inbox",
  "5 custom folders",
  "Message search",
  "Smart folders, snooze, and bulk actions",
  "7-day message history",
]

export default function PricingPage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          Postbox
        </Link>
        <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Current plan</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Start with the features available today.
          </p>
        </div>

        <div className="mx-auto max-w-md rounded-xl border border-primary bg-primary/5 p-6 shadow-lg shadow-primary/10">
          <h2 className="text-lg font-semibold text-foreground">Free</h2>
          <div className="mt-3">
            <span className="text-3xl font-bold text-foreground">$0</span>
            <span className="text-sm text-muted-foreground"> forever</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Email essentials for personal use.</p>
          <ul className="mt-6 space-y-2.5">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 text-primary">✓</span>
                {feature}
              </li>
            ))}
          </ul>
          <Link href="/sign-up" className="mt-6 flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
            Get started
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Paid plans, AI features, and team collaboration are not available yet.
        </p>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          Connected mail is synced to the service. Account credentials are encrypted at rest.{' '}
          <Link href="/sign-up" className="text-primary hover:underline">Start free</Link>
        </p>
      </section>
    </div>
  )
}
