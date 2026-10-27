"use client"

import useSWR from "swr"
import { listMessageActivity } from "@/app/actions/activity"
import { Activity } from "lucide-react"

export function MessageActivity({ messageId }: { messageId: number }) {
  const { data: events = [], isLoading } = useSWR(
    ["message-activity", messageId],
    () => listMessageActivity(messageId),
  )

  return (
    <section className="mt-8 border-t border-border pt-5" aria-label="Message activity">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Activity className="h-4 w-4" /> Activity
      </h2>
      {isLoading ? (
        <p className="py-2 text-sm text-muted-foreground">Loading activity…</p>
      ) : events.length ? (
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3 text-xs">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-foreground"><span className="font-medium">{event.actorName}</span> {event.description}</p>
                <time dateTime={event.createdAt} className="text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString()}
                </time>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      )}
    </section>
  )
}
