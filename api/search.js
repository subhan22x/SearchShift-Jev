import { searchBrave } from '../server/brave-search.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const url = new URL(request.url, `https://${request.headers.host ?? 'localhost'}`)
  const query = url.searchParams.get('q')?.trim() ?? ''

  if (query.length < 3) return response.status(400).json({ error: 'Enter at least three characters' })

  try {
    const data = await searchBrave(query, process.env.BRAVE_SEARCH_API_KEY)
    response.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300')
    return response.status(200).json(data)
  } catch (error) {
    const status = error instanceof Error && error.message === 'Search is not configured' ? 503 : 502
    return response.status(status).json({ error: 'Live search is temporarily unavailable' })
  }
}
