"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Download } from "lucide-react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

type PwaInstallContextValue = {
  installed: boolean
  install: () => Promise<void>
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null)

export function PwaInstallProvider({ children }: { children: ReactNode }) {
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

    function handleInstalled() {
      setInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

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

  return <PwaInstallContext.Provider value={{ installed, install }}>{children}</PwaInstallContext.Provider>
}

export function PwaInstallMenuItem() {
  const pwa = useContext(PwaInstallContext)
  if (!pwa || pwa.installed) return null

  return (
    <DropdownMenuItem onClick={() => void pwa.install()}>
      <Download className="h-4 w-4" />
      Install Postbox
    </DropdownMenuItem>
  )
}
