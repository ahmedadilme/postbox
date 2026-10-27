const endpoint = process.env.SYNC_ENDPOINT ?? "http://localhost:3000/api/sync"
const secret = process.env.SYNC_CRON_SECRET
const intervalMs = Number(process.env.SYNC_INTERVAL_MS ?? 300_000)

if (!endpoint) throw new Error("SYNC_ENDPOINT is required")
if (!secret) throw new Error("SYNC_CRON_SECRET is required")
if (!Number.isSafeInteger(intervalMs) || intervalMs < 60_000) {
  throw new Error("SYNC_INTERVAL_MS must be an integer of at least 60000 milliseconds")
}

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

while (true) {
  try {
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(4 * 60_000),
    })

    if (!response.ok) {
      console.error(`Scheduled sync returned HTTP ${response.status}`)
    } else {
      const result = await response.json()
      console.log(JSON.stringify({
        event: "scheduled_sync_complete",
        synced: result.synced,
        failed: result.failed,
        outbox: result.outbox,
      }))
    }
  } catch (error) {
    console.error("Scheduled sync request failed", error instanceof Error ? error.message : "Unknown error")
  }

  await sleep(intervalMs)
}
