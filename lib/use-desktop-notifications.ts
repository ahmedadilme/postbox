"use client"

import { useEffect, useRef } from "react"
import type { MailMessage } from "@/lib/mail/types"

export function useDesktopNotifications(messages: MailMessage[], enabled = true) {
  const notifiedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!enabled || messages.length === 0) return

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }

    const newUnread = messages.filter(
      (m) => !m.isRead && !notifiedRef.current.has(m.id),
    )

    for (const m of newUnread) {
      notifiedRef.current.add(m.id)

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(m.fromName, {
          body: m.subject ? `${m.subject} — ${m.preview}` : m.preview,
          icon: "/icon-light-32x32.png",
          tag: `postbox-${m.id}`,
        })
      }
    }
  }, [messages, enabled])
}
