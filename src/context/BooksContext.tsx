import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import type { Book, BookStatus, BookType } from '../types/book'
import { fetchBooks, addBook, updateBook, initializeSheet } from '../services/sheets'
import { cacheGet, cacheSet } from '../services/cache'

export interface FiltersState {
  status: BookStatus | 'all'
  type:   BookType  | 'all'
  genres: string[]
}

const BLANK_FILTERS: FiltersState = {
  status: 'all',
  type:   'all',
  genres: [],
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
  allGenres:         string[]
  gbIndex:           Record<string, Book>
  flIndex:           Record<string, Book>
  titleIndex:        Record<string, Book>
  load:         () => Promise<void>
  create:       (b: Book) => Promise<void>
  edit:         (b: Book) => Promise<void>
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

    // Stale-while-revalidate: render the cached list instantly, then replace
    // it with the fresh copy from Sheets when the fetch completes.
    const cached = await cacheGet<Book[]>('books')
    if (cached?.length) dispatch({ type: 'SET', payload: cached })

    if (!navigator.onLine) return   // cached data is already on screen

    try {
      await initializeSheet()
      dispatch({ type: 'SET', payload: await fetchBooks() })
    } catch (e) {
      // With cached data on screen a transient fetch error is not fatal
      if (!cached?.length) dispatch({ type: 'ERROR', payload: String(e) })
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

  // Keep the cache in sync with whatever is on screen (best-effort)
  useEffect(() => {
    if (state.books.length > 0) void cacheSet('books', state.books)
  }, [state.books])

  const setQuery     = useCallback((q: string) => dispatch({ type: 'QUERY', payload: q }), [])
  const setFilters   = useCallback((f: Partial<FiltersState>) => dispatch({ type: 'SET_FILTERS', payload: f }), [])
  const clearFilters = useCallback(() => dispatch({ type: 'CLEAR_FILTERS' }), [])

  const filtered = useMemo(() => {
    const { filters, query } = state
    return state.books.filter(b => {
      if (filters.status !== 'all' && b.status !== filters.status) return false
      if (filters.type   !== 'all' && b.type   !== filters.type)   return false
      if (filters.genres.length > 0) {
        const bookGenres = b.genres ?? []
        if (!filters.genres.some(g => bookGenres.includes(g))) return false
      }
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
    if (f.genres.length > 0) n++
    return n
  }, [state.filters])

  const allGenres = useMemo(() => {
    const set = new Set<string>()
    for (const b of state.books)
      for (const g of (b.genres ?? []))
        if (g) set.add(g)
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [state.books])

  const gbIndex    = useMemo(() => buildIndex(state.books, b => b.gb_id),       [state.books])
  const flIndex    = useMemo(() => buildIndex(state.books, b => b.fl_work_id),   [state.books])
  const titleIndex = useMemo(() => buildIndex(state.books, b =>
    normalizeKey(b.author, b.title)), [state.books])

  return (
    <BooksCtx.Provider value={{
      ...state, filtered, activeFilterCount, allGenres,
      gbIndex, flIndex, titleIndex,
      load, create, edit, setQuery, setFilters, clearFilters,
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
