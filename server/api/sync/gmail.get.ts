import { runIncrementalSync, setSyncState } from '../../utils/sync'

export default defineEventHandler(async (event) => {
  // Ensure user is logged in before firing background task
  await requireUserSession(event)

  // Set syncing flag synchronously before returning
  await setSyncState('gmail_syncing', '1')
  await setSyncState('gmail_new_count', '0')

  // Fire background sync — does not block the response
  setImmediate(async () => {
    try {
      const count = await runIncrementalSync(event)
      await setSyncState('gmail_new_count', String(count))
    } catch (err) {
      console.error('[sync] incremental sync failed:', err)
    } finally {
      await setSyncState('gmail_syncing', '0')
    }
  })

  return { syncing: true }
})
