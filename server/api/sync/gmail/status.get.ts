import { getSyncState } from '../../../utils/sync'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const syncing = await getSyncState('gmail_syncing')
  const newCount = await getSyncState('gmail_new_count')

  return {
    syncing: syncing === '1',
    newCount: Number(newCount ?? 0)
  }
})
