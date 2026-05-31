import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import type { Book, BookStatus, BookType } from '../types/book'
import { fetchBooks, addBook, updateBook, deleteBook, initializeSheet } from '../services/sheets'

export interface FiltersState {
  status: BookStatus | 'all'
  type:   BookType  | 'all'
}

const BLANK_FILTERS: FiltersState = {
  status: 'all',
  type:   'all',
}

interface State {
  books:   Book[]
  loading: boolean
  error:   string | null
  query:   string
  filters: FiltersState
}

type Action =
  | { type: 'LOADING' }
  | { type: 'SET';          payload: Book[] }
  | { type: 'ADD';          payload: Book }
  | { type: 'UPDATE';       payload: Book }
  | { type: 'DELETE';       payload: string }
  | { type: 'ERROR';        payload: string }
  | { type: 'QUERY';        payload: string }
  | { type: 'SET_FILTERS';  payload: Partial<FiltersState> }
  | { type: 'CLEAR_FILTERS' }

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'LOADING':       return { ...s, loading: true, error: null }
    case 'SET':           return { ...s, books: a.payload, loading: false, error: null }
    case 'ADD':           return { ...s, books: [...s.books, a.payload] }
    case 'UPDATE':        return { ...s, books: s.books.map(b => b.id === a.payload.id ? a.payload : b) }
    case 'DELETE':        return { ...s, books: s.books.filter(b => b.id !== a.payload) }
    case 'ERROR':         return { ...s, error: a.payload, loading: false }
    case 'QUERY':         return { ...s, query: a.payload }
    case 'SET_FILTERS':   return { ...s, filters: { ...s.filters, ...a.payload } }
    case 'CLEAR_FILTERS': return { ...s, filters: { ...BLANK_FILTERS } }
    default:              return s
  }
}

export function normalizeKey(author = '', title = ''): string {
  return [author, title]
    .join('|')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\wа-яa-z|]/g, '')
    .trim()
}

function buildIndex<T>(items: T[], keyFn: (item: T) => string | undefined): Record<string, T> {
  const map: Record<string, T> = {}
  for (const item of items) {
    const k = keyFn(item)
    if (k) map[k] = item
  }
  return map
}

interface Ctx extends State {
  filtered:          Book[]
  activeFilterCount: number
  gbIndex:           Record<string, Book>
  flIndex:           Record<string, Book>
  titleIndex:        Record<string, Book>
  load:         () => Promise<void>
  create:       (b: Book) => Promise<void>
  edit:         (b: Book) => Promise<void>
  remove:       (b: Book) => Promise<void>
  setQuery:     (q: string) => void
  setFilters:   (f: Partial<FiltersState>) => void
  clearFilters: () => void
}

const BooksCtx = createContext<Ctx | null>(null)

export function BooksProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    books: [], loading: false, error: null,
    query: '', filters: { ...BLANK_FILTERS },
  })

  const load = useCallback(async () => {
    dispatch({ type: 'LOADING' })
    try {
      await initializeSheet()
      dispatch({ type: 'SET', payload: await fetchBooks() })
    } catch (e) {
      dispatch({ type: 'ERROR', payload: String(e) })
    }
  }, [])

  const create = useCallback(async (b: Book) => {
    const saved = await addBook(b)
    dispatch({ type: 'ADD', payload: saved })
  }, [])

  const edit = useCallback(async (b: Book) => {
    await updateBook(b)
    dispatch({ type: 'UPDATE', payload: b })
  }, [])

  const remove = useCallback(async (b: Book) => {
    await deleteBook(b)
    dispatch({ type: 'DELETE', payload: b.id })
  }, [])

  const setQuery     = useCallback((q: string) => dispatch({ type: 'QUERY', payload: q }), [])
  const setFilters   = useCallback((f: Partial<FiltersState>) => dispatch({ type: 'SET_FILTERS', payload: f }), [])
  const clearFilters = useCallback(() => dispatch({ type: 'CLEAR_FILTERS' }), [])

  const filtered = useMemo(() => {
    const { filters, query } = state
    return state.books.filter(b => {
      if (filters.status !== 'all' && b.status !== filters.status) return false
      if (filters.type   !== 'all' && b.type   !== filters.type)   return false
      if (query) {
        const q = query.toLowerCase()
        const match =
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          !!b.series_name?.toLowerCase().includes(q) ||
          !!(b.genres ?? []).some(g => g.toLowerCase().includes(q))
        if (!match) return false
      }
      return true
    })
  }, [state])

  const activeFilterCount = useMemo(() => {
    const f = state.filters
    let n = 0
    if (f.status !== 'all') n++
    if (f.type   !== 'all') n++
    return n
  }, [state.filters])

  const gbIndex    = useMemo(() => buildIndex(state.books, b => b.gb_id),       [state.books])
  const flIndex    = useMemo(() => buildIndex(state.books, b => b.fl_work_id),   [state.books])
  const titleIndex = useMemo(() => buildIndex(state.books, b =>
    normalizeKey(b.author, b.title)), [state.books])

  return (
    <BooksCtx.Provider value={{
      ...state, filtered, activeFilterCount,
      gbIndex, flIndex, titleIndex,
      load, create, edit, remove, setQuery, setFilters, clearFilters,
    }}>
      {children}
    </BooksCtx.Provider>
  )
}

export function useBooks() {
  const ctx = useContext(BooksCtx)
  if (!ctx) throw new Error('useBooks outside BooksProvider')
  return ctx
}
