import { db } from "@/lib/db"
import { messageActivity } from "@/lib/db/schema"

export async function recordMessageActivity(input: {
  teamId: string
  messageId: number
  actorId: string
  kind: "assignment" | "comment"
  description: string
}) {
  await db.insert(messageActivity).values(input)
}
