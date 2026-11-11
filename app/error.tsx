"use client"

import { useEffect } from "react"
import { AlertCircle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 text-center bg-background">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            {error?.message || "An unexpected error occurred while loading this page."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => reset()} className="gap-2">
            <RotateCw className="h-4 w-4" />
            Try again
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            Go to home
          </Button>
        </div>
      </div>
    </div>
  )
}
