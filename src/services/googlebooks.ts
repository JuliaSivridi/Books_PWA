const BASE = 'https://www.googleapis.com/books/v1'

export class GBRateLimitError extends Error {
  constructor() { super('Google Books rate limit — add an API key in Settings') }
}

export interface GBVolume {
  id: string
  volumeInfo: {
    title: string
    authors?: string[]
    publishedDate?: string
    imageLinks?: {
      thumbnail: string
      smallThumbnail: string
    }
    categories?: string[]
    infoLink: string
    industryIdentifiers?: Array<{
      type: string
      identifier: string
    }>
  }
}

export function getGBKey(): string {
  return localStorage.getItem('gb_key') || ''
}

export async function searchBooks(query: string): Promise<GBVolume[]> {
  const key = getGBKey()
  const params = new URLSearchParams({ q: query, maxResults: '8' })
  if (key) params.set('key', key)

  try {
    const res = await fetch(`${BASE}/volumes?${params}`)
    if (res.status === 429) throw new GBRateLimitError()
    if (!res.ok) return []
    const data = await res.json()
    return (data.items as GBVolume[]) ?? []
  } catch (e) {
    if (e instanceof GBRateLimitError) throw e
    return []
  }
}

export async function getBookDetails(gbId: string): Promise<{ isbn13: string | null; categories: string[] }> {
  const key = getGBKey()
  const url = `${BASE}/volumes/${gbId}${key ? `?key=${key}` : ''}`
  try {
    const res = await fetch(url)
    if (!res.ok) return { isbn13: null, categories: [] }
    const data = await res.json() as GBVolume
    const identifiers = data.volumeInfo.industryIdentifiers ?? []
    const isbn13 = identifiers.find(i => i.type === 'ISBN_13')?.identifier ?? null
    const categories = data.volumeInfo.categories ?? []
    return { isbn13, categories }
  } catch {
    return { isbn13: null, categories: [] }
  }
}

export function getCoverUrl(imageLinks?: GBVolume['volumeInfo']['imageLinks']): string | undefined {
  const url = imageLinks?.thumbnail || imageLinks?.smallThumbnail
  return url ? url.replace('http://', 'https://') : undefined
}
