"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Download } from "lucide-react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export function PwaInstallMenuItem() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Installation can still work in browsers that don't support service workers.
      })
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    setInstalled(standalone)

    function handleInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt)
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt)
  }, [])

  if (installed) return null

  async function install() {
    if (!installPrompt) {
      toast.info("On iPhone or iPad, tap Share, then Add to Home Screen. On Android, open the browser menu and choose Install app.")
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    if (choice.outcome === "accepted") setInstalled(true)
  }

  return (
    <DropdownMenuItem onClick={() => void install()}>
      <Download className="h-4 w-4" />
      Install Postbox
    </DropdownMenuItem>
  )
}
