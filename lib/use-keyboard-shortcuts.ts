"use client"

import { useEffect } from "react"
import type { FolderType, MailMessage } from "@/lib/mail/types"

export type ShortcutAction =
  | { type: "navigate"; direction: "next" | "prev" }
  | { type: "select"; index: number }
  | { type: "reply" }
  | { type: "replyAll" }
  | { type: "forward" }
  | { type: "archive" }
  | { type: "delete" }
  | { type: "star" }
  | { type: "flag" }
  | { type: "toggleRead" }
  | { type: "focusSearch" }
  | { type: "compose" }
  | { type: "goToFolder"; folder: FolderType }

export function useKeyboardShortcuts(
  handler: (action: ShortcutAction) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return

    let gPressed = false

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable

      if (e.key === "g" && !isInput) {
        gPressed = true
        setTimeout(() => { gPressed = false }, 500)
        return
      }

      if (gPressed) {
        gPressed = false
        switch (e.key) {
          case "i": handler({ type: "goToFolder", folder: "inbox" }); return
          case "s": handler({ type: "goToFolder", folder: "sent" }); return
          case "d": handler({ type: "goToFolder", folder: "drafts" }); return
          case "a": handler({ type: "goToFolder", folder: "archive" }); return
          case "t": handler({ type: "goToFolder", folder: "trash" }); return
        }
        return
      }

      if (isInput) {
        if (e.key === "Escape") {
          (target as HTMLElement).blur()
        }
        return
      }

      switch (e.key) {
        case "j": handler({ type: "navigate", direction: "next" }); break
        case "k": handler({ type: "navigate", direction: "prev" }); break
        case "r": handler({ type: "reply" }); break
        case "a": handler({ type: "replyAll" }); break
        case "f": handler({ type: "forward" }); break
        case "e": handler({ type: "archive" }); break
        case "#":
        case "d": handler({ type: "delete" }); break
        case "s": handler({ type: "star" }); break
        case "u": handler({ type: "toggleRead" }); break
        case "/":
          e.preventDefault()
          handler({ type: "focusSearch" })
          break
        case "c": handler({ type: "compose" }); break
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [handler, enabled])
}
