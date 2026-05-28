export type BookStatus = 'want' | 'reading' | 'read'

export type BookType =
  | 'novel'       // роман
  | 'story'       // рассказ
  | 'novella'     // повесть
  | 'collection'  // сборник
  | 'other'       // прочее

export interface Book {
  id:               string
  title:            string
  author:           string
  year?:            number
  status:           BookStatus
  type?:            BookType
  cover_url?:       string
  gb_id?:           string
  gb_url?:          string
  fl_work_id?:      string
  fl_url?:          string
  wiki_url?:        string
  genres?:          string[]
  container_title?: string
  series_name?:     string
  series_order?:    number
  _row?:            number          // 1-based Google Sheets row (not saved)
}

export const STATUS_LABELS: Record<BookStatus, string> = {
  want: 'Want', reading: 'Reading', read: 'Read',
}

export const STATUS_COLORS: Record<BookStatus, string> = {
  want: '#f59e0b', reading: '#3b82f6', read: '#10b981',
}

export const TYPE_LABELS: Record<BookType, string> = {
  novel: 'Роман', story: 'Рассказ', novella: 'Повесть',
  collection: 'Сборник', other: 'Прочее',
}
