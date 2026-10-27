"use client"

import useSWR from "swr"
import { useSWRConfig } from "swr"
import { useState } from "react"
import { assignMessage, listTeamAssignees } from "@/app/actions/assignments"
import { toast } from "sonner"

export function MessageAssignment({
  messageId,
  assignedUserId,
  onChanged,
}: {
  messageId: number
  assignedUserId: string | null
  onChanged: () => void
}) {
  const { data: members = [] } = useSWR("team-assignees", () => listTeamAssignees())
  const { mutate: mutateKey } = useSWRConfig()
  const [saving, setSaving] = useState(false)

  async function handleChange(value: string) {
    setSaving(true)
    try {
      await assignMessage(messageId, value || null)
      await mutateKey(["message-activity", messageId])
      onChanged()
      toast.success(value ? "Message assigned" : "Assignment removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update assignment")
    } finally {
      setSaving(false)
    }
  }

  return (
    <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Assigned to</span>
      <select
        aria-label="Assign message to a teammate"
        value={assignedUserId ?? ""}
        disabled={saving}
        onChange={(event) => void handleChange(event.target.value)}
        className="max-w-56 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}
      </select>
      {saving && <span>Saving…</span>}
    </label>
  )
}
