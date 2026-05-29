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

export async function searchBooks(query: string): Promise<FLSearchResult> {
  try {
    const res = await fetch(`${BASE}/search-work?q=${encodeURIComponent(query)}&page=1&onlymatches=1`)
    if (!res.ok) return { works: [] }
    return await res.json() as FLSearchResult
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
