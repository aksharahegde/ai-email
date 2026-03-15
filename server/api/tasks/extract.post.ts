import { getSyncState } from '../../utils/sync'
import { runTaskExtraction } from '../../utils/tasks'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const extracting = (await getSyncState('tasks_extracting')) === '1'
  if (extracting) return { extracting: true }

  setImmediate(async () => {
    try { await runTaskExtraction(event) }
    catch (err) { console.error('[tasks] extraction failed:', err) }
  })

  return { extracting: true }
})
