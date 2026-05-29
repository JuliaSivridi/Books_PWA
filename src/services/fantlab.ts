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

// FantLab API blocks browser requests (no CORS headers).
// Search is disabled; URLs are entered manually in the form.
export async function searchBooks(_query: string): Promise<FLSearchResult> {
  return { works: [] }
}

export function getWorkUrl(workId: number): string {
  return `https://fantlab.ru/work${workId}`
}

export function mapWorkType(workTypeName: string): BookType {
  return FL_TYPE_MAP[workTypeName] ?? 'other'
}
