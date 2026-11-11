"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { initials } from "@/lib/mail/format"
import { LogOut, Settings, Plus, ExternalLink } from "lucide-react"
import { PwaInstallMenuItem, PwaInstallProvider } from "@/components/pwa-install-menu-item"

export function MailHeader({
  userName,
  userEmail,
  onAddAccount,
  onManageAccounts,
}: {
  userName: string
  userEmail: string
  onAddAccount: () => void
  onManageAccounts?: () => void
}) {
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <PwaInstallProvider>
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{userEmail}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={onAddAccount}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add account</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account menu"
            className="rounded-full outline-none ring-ring focus-visible:ring-2"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {initials(userName)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{userName}</span>
                  <span className="text-xs font-normal text-muted-foreground">{userEmail}</span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.location.href = "/settings"}>
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onManageAccounts ?? onAddAccount}>
              <ExternalLink className="h-4 w-4" />
              Manage accounts
            </DropdownMenuItem>
            <PwaInstallMenuItem />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    </PwaInstallProvider>
  )
}
