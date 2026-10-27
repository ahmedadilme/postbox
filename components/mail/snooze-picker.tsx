"use client"

import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Clock } from "lucide-react"

function snoozeTime(label: string, minutes: number): { label: string; date: Date } {
  return { label, date: new Date(Date.now() + minutes * 60 * 1000) }
}

const PRESETS = [
  snoozeTime("Later today", 2),
  snoozeTime("This evening", 6),
  snoozeTime("Tomorrow morning", 60 * 18),
  snoozeTime("This weekend", 60 * 24 * 3),
  snoozeTime("Next week", 60 * 24 * 7),
]

export function SnoozePicker({
  onSnooze,
  onUnsnooze,
  isSnoozed,
  children,
}: {
  onSnooze: (until: Date) => void
  onUnsnooze?: () => void
  isSnoozed?: boolean
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" />}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isSnoozed && onUnsnooze && (
          <>
            <DropdownMenuItem onClick={onUnsnooze}>
              <Clock className="h-4 w-4" />
              Unsnooze
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {PRESETS.map((p) => (
          <DropdownMenuItem key={p.label} onClick={() => onSnooze(p.date)}>
            <Clock className="h-4 w-4" />
            {p.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
