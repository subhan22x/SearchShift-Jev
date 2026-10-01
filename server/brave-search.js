const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search'

function plainText(value) {
  return value
    .replace(/&lt;[^&]*?&gt;/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactResult(result) {
  return {
    title: plainText(result.title ?? 'Untitled result'),
    url: result.url,
    description: plainText(result.description ?? result.profile?.long_name ?? 'Open this result to learn more.'),
  }
}

// This shared server utility keeps the provider key out of both React and API responses.
export async function searchBrave(query, apiKey) {
  if (!apiKey) throw new Error('Search is not configured')

  const request = new URL(BRAVE_ENDPOINT)
  request.searchParams.set('q', query.slice(0, 300))
  request.searchParams.set('count', '3')
  request.searchParams.set('country', 'US')
  request.searchParams.set('search_lang', 'en')
  request.searchParams.set('safesearch', 'moderate')

  const response = await fetch(request, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) throw new Error(`Search provider returned ${response.status}`)

  const payload = await response.json()
  return {
    query,
    results: (payload.web?.results ?? []).slice(0, 3).map(compactResult),
  }
}
