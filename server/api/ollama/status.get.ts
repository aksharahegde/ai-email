export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const baseUrl = (query.url as string) || 'http://localhost:11434'

  try {
    const tags = await $fetch<{ models?: Array<{ name: string; size: number }> }>(`${baseUrl}/api/tags`)
    const models = tags.models?.map(m => ({
      name: m.name,
      size: m.size ?? 0
    })) ?? []

    return {
      connected: true,
      models
    }
  } catch {
    return {
      connected: false,
      models: []
    }
  }
})
