"use client"

import Link from "next/link"
import { Mail, ChevronRight, Star, Zap, Shield, Users, Layers, ArrowRight } from "lucide-react"

export function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Nav */}
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Mail className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">Postbox</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
          <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link
            href="/sign-up"
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Get Started Free
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 py-24 text-center md:py-32">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            A simpler way to manage multiple inboxes
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Your unified inbox.
            <br />
            <span className="text-primary">Your mail, in one place.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            Connect mail accounts that provide IMAP and SMTP access, then read and send mail from one dashboard.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-xs text-muted-foreground">No credit card required</span>
          </div>
        </div>
      </section>

      {/* Logo Strip */}
      <section className="border-y border-border bg-muted/30 py-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-6 text-sm text-muted-foreground">
          <span className="font-medium">Works with</span>
          <span>IMAP</span>
          <span>SMTP</span>
          <span>Custom mail servers</span>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-24 md:grid-cols-3">
        <FeatureCard
          icon={<Layers className="h-5 w-5" />}
          title="Unified Inbox"
          desc="Connect up to two email accounts on the free plan and switch between them or view them together."
        />
        <FeatureCard
          icon={<Zap className="h-5 w-5" />}
          title="Keyboard shortcuts"
          desc="Use keyboard shortcuts to move through messages and handle common inbox actions."
        />
        <FeatureCard
          icon={<Star className="h-5 w-5" />}
          title="Search your mail"
          desc="Search messages across connected accounts by their available message details and content."
        />
        <FeatureCard
          icon={<Shield className="h-5 w-5" />}
          title="Credential protection"
          desc="Mail is synced to the service so it can appear in your dashboard. Connected account credentials are encrypted at rest."
        />
        <FeatureCard
          icon={<Users className="h-5 w-5" />}
          title="Multiple accounts"
          desc="Keep work, personal, and other connected inboxes together in one dashboard."
        />
        <FeatureCard
          icon={<Mail className="h-5 w-5" />}
          title="Smart Organization"
          desc="Use custom folders, smart folders, snooze, stars, and bulk actions to organize your messages."
        />
      </section>

      <section className="border-y border-border bg-muted/20 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Straightforward plans for growing teams</h2>
            <p className="mt-3 text-muted-foreground">Start free, then add the features your business needs.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">Free</p>
              <p className="mt-2 text-3xl font-bold text-foreground">$0 <span className="text-sm font-normal text-muted-foreground">forever</span></p>
              <p className="mt-2 text-sm text-muted-foreground">Two accounts, five folders, and seven days of mail history.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">Pro</p>
              <p className="mt-2 text-3xl font-bold text-foreground">$4 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
              <p className="mt-2 text-sm text-muted-foreground">More accounts, full history, and advanced organization for one user.</p>
            </div>
            <div className="rounded-xl border border-primary bg-primary/5 p-5">
              <p className="text-sm font-medium text-muted-foreground">Team</p>
              <p className="mt-2 text-3xl font-bold text-foreground">$6 <span className="text-sm font-normal text-muted-foreground">/ member / month</span></p>
              <p className="mt-2 text-sm text-muted-foreground">Shared drafts, comments, assignments, and collaboration for small teams.</p>
            </div>
          </div>
          <div className="mt-7 text-center">
            <Link href="/pricing" className="text-sm font-medium text-primary hover:underline">See plans and request an upgrade</Link>
            <p className="mt-2 text-xs text-muted-foreground">Paid plans are activated by request during early access. No charge is taken online.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-primary/5 px-6 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Bring your connected inboxes together
        </h2>
        <p className="mt-3 text-muted-foreground">Create an account and connect your first email account.</p>
        <Link
          href="/sign-up"
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Get started free <ChevronRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>Postbox</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
            <Link href="/sign-up" className="hover:text-foreground">Sign up</Link>
          </div>
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Postbox. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-1 text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  )
}
