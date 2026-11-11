"use client"

import { useEffect, useRef } from "react"
import type { MailMessage } from "@/lib/mail/types"

export function useDesktopNotifications(messages: MailMessage[], enabled = true) {
  const notifiedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!enabled || messages.length === 0) return

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try {
        void Notification.requestPermission()
      } catch {
        // Notification permission request failed or is not supported
      }
    }

    const newUnread = messages.filter(
      (m) => !m.isRead && !notifiedRef.current.has(m.id),
    )

    for (const m of newUnread) {
      notifiedRef.current.add(m.id)

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(m.fromName, {
            body: m.subject ? `${m.subject} — ${m.preview}` : m.preview,
            icon: "/icon-light-32x32.png",
            tag: `postbox-${m.id}`,
          })
        } catch {
          // Android Chrome throws TypeError: Illegal constructor for `new Notification()`.
          // Try displaying via the active service worker registration instead.
          if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
            void navigator.serviceWorker.ready.then((reg) => {
              void reg.showNotification(m.fromName, {
                body: m.subject ? `${m.subject} — ${m.preview}` : m.preview,
                icon: "/icon-192.png",
                tag: `postbox-${m.id}`,
              })
            }).catch(() => {})
          }
        }
      }
    }
  }, [messages, enabled])
}
