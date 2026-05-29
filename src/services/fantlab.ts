import type { BookType } from '../types/book'

const BASE = 'https://api.fantlab.ru'

const FL_TYPE_MAP: Record<string, BookType> = {
  // Russian names (from name_type)
  'роман':             'novel',
  'рассказ':           'story',
  'микрорассказ':      'story',
  'повесть':           'novella',
  'сборник':           'collection',
  'антология':         'collection',
  'цикл':              'collection',
  'авторский сборник': 'collection',
  // English icons (from name_type_icon)
  'novel':             'novel',
  'story':             'story',
  'shortstory':        'story',
  'novella':           'novella',
  'cycle':             'collection',
  'anthology':         'collection',
  'collection':        'collection',
}

export interface FLWork {
  work_id: number
  work_name: string
  work_name_orig?: string
  work_year?: number
  authors: Array<{ id: number; name: string }>
  work_type_name: string
  image?: string
}

export interface FLSearchResult {
  works?: FLWork[]
}

// Shape returned by /search-txt mini-cards
interface FLMiniWork {
  id: number
  name?: string
  name_orig?: string
  image?: string
  image_preview?: string
  year?: number
  name_type?: string       // Russian: "Роман", "Рассказ", etc.
  name_type_icon?: string  // English: "novel", "story", "novella", "cycle", etc.
  creators?: {
    authors?: Array<{ id: number; name: string }>
  }
}

function fixImageUrl(url?: string): string | undefined {
  if (!url) return undefined
  if (url.startsWith('//')) return 'https:' + url
  if (url.startsWith('/'))  return 'https://fantlab.ru' + url
  return url
}

export async function searchBooks(query: string): Promise<FLSearchResult> {
  try {
    const res = await fetch(`${BASE}/search-txt?q=${encodeURIComponent(query)}`)
    if (!res.ok) return { works: [] }
    const data = await res.json() as { works?: FLMiniWork[] }
    const works: FLWork[] = (data.works ?? []).map(w => ({
      work_id:        w.id,
      work_name:      w.name ?? '',
      work_name_orig: w.name_orig,
      work_year:      w.year,
      authors:        (w.creators?.authors ?? []).map(a => ({ id: a.id, name: a.name })),
      work_type_name: w.name_type ?? w.name_type_icon ?? '',
      image:          fixImageUrl(w.image_preview ?? w.image),
    }))
    return { works }
  } catch {
    return { works: [] }
  }
}

export function getWorkUrl(workId: number): string {
  return `https://fantlab.ru/work${workId}`
}

interface FLGenreItem {
  label: string
  percent?: number
  genre?: FLGenreItem[]
}

export async function getWorkGenres(workId: number): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/work/${workId}/extended`)
    if (!res.ok) return []
    const data = await res.json() as {
      classificatory?: { genre_group?: Array<{ label: string; genre?: FLGenreItem[] }> }
    }
    const groups = data.classificatory?.genre_group ?? []
    const genreGroup = groups.find(g => /жанр/i.test(g.label))
    if (!genreGroup?.genre) return []

    const result: string[] = []
    const collect = (items: FLGenreItem[]) => {
      for (const item of items) {
        if ((item.percent ?? 0) >= 0.1) {
          result.push(item.label)
          if (item.genre?.length) collect(item.genre)
        }
      }
    }
    collect(genreGroup.genre)
    return result.slice(0, 8)
  } catch {
    return []
  }
}

export function mapWorkType(workTypeName: string): BookType {
  return FL_TYPE_MAP[workTypeName.toLowerCase()] ?? 'other'
}
