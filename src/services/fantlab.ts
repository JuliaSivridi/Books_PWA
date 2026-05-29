import type { BookType } from '../types/book'

const BASE = 'https://api.fantlab.ru'

const FL_TYPE_MAP: Record<string, BookType> = {
  'Роман':             'novel',
  'Рассказ':           'story',
  'Микрорассказ':      'story',
  'Повесть':           'novella',
  'Сборник':           'collection',
  'Антология':         'collection',
  'Цикл':              'collection',
  'Авторский сборник': 'collection',
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
  name_type?: string
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
      work_type_name: w.name_type ?? '',
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

export function mapWorkType(workTypeName: string): BookType {
  return FL_TYPE_MAP[workTypeName] ?? 'other'
}
