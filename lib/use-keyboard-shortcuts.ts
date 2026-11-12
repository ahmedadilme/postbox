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
      // Never intercept browser or OS combinations (e.g. Ctrl+C to copy, Ctrl+A to select all, Cmd+C, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }

      const target = e.target as HTMLElement | null
      const isInput =
        Boolean(
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable ||
            target.closest?.("[contenteditable='true']"))
        )

      if (e.key === "g" && !isInput) {
        gPressed = true
        setTimeout(() => { gPressed = false }, 500)
        return
      }

      if (gPressed) {
        gPressed = false
        switch (e.key.toLowerCase()) {
          case "i": handler({ type: "goToFolder", folder: "inbox" }); return
          case "s": handler({ type: "goToFolder", folder: "sent" }); return
          case "d": handler({ type: "goToFolder", folder: "drafts" }); return
          case "p": handler({ type: "goToFolder", folder: "spam" }); return
          case "a": handler({ type: "goToFolder", folder: "archive" }); return
          case "t": handler({ type: "goToFolder", folder: "trash" }); return
        }
        return
      }

      if (isInput) {
        if (e.key === "Escape" && target) {
          target.blur()
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
        case "Delete": handler({ type: "delete" }); break
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
