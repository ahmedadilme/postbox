"use client"

import { Zap } from "lucide-react"
import Link from "next/link"

export function UpgradeBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
      <Zap className="h-4 w-4 shrink-0 text-primary" />
      <span className="flex-1 text-foreground">{message}</span>
      <Link
        href="/settings?tab=billing"
        className="shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        Upgrade
      </Link>
    </div>
  )
}
