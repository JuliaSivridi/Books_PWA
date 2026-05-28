import { useEffect, useRef, useState } from 'react'
import type { Book, BookStatus, BookType } from '../types/book'
import { STATUS_LABELS, TYPE_LABELS } from '../types/book'
import { searchBooks as gbSearch, getBookDetails, getCoverUrl, GBRateLimitError } from '../services/googlebooks'
import { searchBooks as flSearch, getWorkUrl, mapWorkType } from '../services/fantlab'
import type { GBVolume } from '../services/googlebooks'
import type { FLWork } from '../services/fantlab'
import { lookupByIsbn } from '../services/wikidata'
import { useBooks, normalizeKey } from '../context/BooksContext'
import styles from './AddBookModal.module.css'

/* ── types ────────────────────────────────────────────────────────── */

interface SearchResult {
  fl: FLWork | null
  gb: GBVolume | null
}

type Phase    = 'search' | 'form'
type FormData = Omit<Book, 'id' | '_row'>

const BLANK: FormData = {
  title: '', author: '', status: 'want',
  year: undefined, type: undefined,
  cover_url: undefined, gb_id: undefined, gb_url: undefined,
  fl_work_id: undefined, fl_url: undefined, wiki_url: undefined,
  genres: undefined, container_title: undefined,
  series_name: undefined, series_order: undefined,
}

function uuid(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2)
}

/* ── result helpers ───────────────────────────────────────────────── */

function getTitle(r: SearchResult)  { return r.fl?.work_name ?? r.gb?.volumeInfo.title ?? '' }
function getAuthor(r: SearchResult) { return r.fl?.authors[0]?.name ?? r.gb?.volumeInfo.authors?.[0] ?? '' }
function getYear(r: SearchResult): number | undefined {
  const y = r.fl?.work_year ??
    (r.gb?.volumeInfo.publishedDate ? parseInt(r.gb.volumeInfo.publishedDate.slice(0, 4)) : undefined)
  return y && !isNaN(y) ? y : undefined
}
function getCover(r: SearchResult): string | undefined {
  return r.fl?.image ?? getCoverUrl(r.gb?.volumeInfo.imageLinks)
}

/* ── search merge ─────────────────────────────────────────────────── */

function mergeResults(gbResults: GBVolume[], flWorks: FLWork[]): SearchResult[] {
  const merged: SearchResult[] = []
  const keyMap = new Map<string, SearchResult>()

  for (const fl of flWorks) {
    const key = normalizeKey(fl.authors[0]?.name ?? '', fl.work_name)
    const entry: SearchResult = { fl, gb: null }
    merged.push(entry)
    keyMap.set(key, entry)
  }

  for (const gb of gbResults) {
    const key = normalizeKey(gb.volumeInfo.authors?.[0] ?? '', gb.volumeInfo.title)
    const existing = keyMap.get(key)
    if (existing) {
      existing.gb = gb
    } else {
      merged.push({ fl: null, gb })
    }
  }

  return merged
}

/* ── component ────────────────────────────────────────────────────── */

interface Props { book?: Book; onClose: () => void }

export default function AddBookModal({ book, onClose }: Props) {
  const { create, edit, gbIndex, flIndex, titleIndex } = useBooks()

  const [editTarget, setEditTarget] = useState<Book | null>(book ?? null)
  const isEdit = !!editTarget

  const [phase,        setPhase]        = useState<Phase>(book ? 'form' : 'search')
  const [form,         setForm]         = useState<FormData>(book ? { ...book } : { ...BLANK })
  const [linksLoading, setLinksLoading] = useState(false)
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState<SearchResult[]>([])
  const [searching,    setSearching]    = useState(false)
  const [gbRateLimit,  setGbRateLimit]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState('')

  const timerRef     = useRef<ReturnType<typeof setTimeout>>()
  const overlayRef   = useRef<HTMLDivElement>(null)
  const currentGbRef = useRef<string | null>(null)

  /* ── debounced parallel search ────────────────────────────────── */

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (query.length < 2) { setResults([]); setGbRateLimit(false); return }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      setGbRateLimit(false)
      const [gbRes, flRes] = await Promise.allSettled([
        gbSearch(query),
        flSearch(query),
      ])
      if (gbRes.status === 'rejected' && gbRes.reason instanceof GBRateLimitError) {
        setGbRateLimit(true)
      }
      const gbBooks = gbRes.status === 'fulfilled' ? gbRes.value : []
      const flWorks = flRes.status === 'fulfilled' ? (flRes.value.works ?? []) : []
      setResults(mergeResults(gbBooks, flWorks))
      setSearching(false)
    }, 400)
    return () => clearTimeout(timerRef.current)
  }, [query])

  /* ── helpers ──────────────────────────────────────────────────── */

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function findDuplicate(result: SearchResult): Book | undefined {
    const gbId = result.gb?.id
    const flId = result.fl?.work_id != null ? String(result.fl.work_id) : undefined
    const title = getTitle(result)
    const author = getAuthor(result)
    return (gbId ? gbIndex[gbId] : undefined) ??
      (flId ? flIndex[flId] : undefined) ??
      titleIndex[normalizeKey(author, title)]
  }

  /* ── duplicate → edit mode ────────────────────────────────────── */

  function selectDuplicate(existing: Book) {
    currentGbRef.current = null
    setEditTarget(existing)
    setForm({ ...existing })
    setPhase('form')
  }

  /* ── new result → fill form + background enrichment ──────────── */

  async function selectResult(result: SearchResult) {
    const title      = getTitle(result)
    const author     = getAuthor(result)
    const year       = getYear(result)
    const type       = result.fl ? mapWorkType(result.fl.work_type_name) : undefined
    const cover_url  = getCover(result)
    const gb_id      = result.gb?.id
    const gb_url     = result.gb?.volumeInfo.infoLink
    const fl_work_id = result.fl?.work_id != null ? String(result.fl.work_id) : undefined
    const fl_url     = result.fl ? getWorkUrl(result.fl.work_id) : undefined

    currentGbRef.current = gb_id ?? null

    setForm({
      title, author, year, type,
      status: form.status,
      cover_url,
      gb_id, gb_url,
      fl_work_id, fl_url,
      wiki_url: undefined,
      genres: undefined,
      container_title: undefined,
      series_name: undefined,
      series_order: undefined,
    })
    setPhase('form')

    if (!gb_id) return

    setLinksLoading(true)
    try {
      const { isbn13, categories } = await getBookDetails(gb_id)
      if (currentGbRef.current !== gb_id) return

      if (categories.length) setForm(f => ({ ...f, genres: categories }))

      if (isbn13) {
        const { wiki_url } = await lookupByIsbn(isbn13)
        if (currentGbRef.current !== gb_id) return
        if (wiki_url) setForm(f => ({ ...f, wiki_url }))
      }
    } finally {
      if (currentGbRef.current === gb_id) setLinksLoading(false)
    }
  }

  /* ── save ─────────────────────────────────────────────────────── */

  async function handleSave() {
    if (!form.title && !form.author) {
      setSaveError('Enter at least a title or author')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      if (isEdit && editTarget) {
        await edit({ ...editTarget, ...form })
      } else {
        await create({ id: uuid(), ...form })
      }
      onClose()
    } catch (e) {
      setSaveError(String(e))
    } finally {
      setSaving(false)
    }
  }

  /* ── render ───────────────────────────────────────────────────── */

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && onClose()}
    >
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          {phase === 'form' && !isEdit && (
            <button className={styles.backBtn} onClick={() => setPhase('search')} title="Back to search">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <h2>{isEdit ? 'Edit book' : 'Add book'}</h2>
          <button className={styles.close} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className={styles.body}>

          {/* ── SEARCH PHASE ─────────────────────────────────── */}
          {phase === 'search' && (
            <div className={styles.searchPhase}>
              <div className={styles.searchWrap}>
                <input
                  type="search"
                  placeholder="Title or author…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus
                />
                {searching && <div className={styles.miniSpinner} />}
              </div>

              {searching && (
                <p className={styles.searchHint}>Searching Google Books and FantLab…</p>
              )}

              {gbRateLimit && (
                <p className={styles.rateLimitWarn}>
                  Google Books daily limit reached — add an API key in{' '}
                  <button className={styles.settingsLink} onClick={onClose}>Settings</button>
                  {' '}to restore search.
                </p>
              )}

              {results.length > 0 && (
                <div className={styles.results}>
                  {results.map((result, i) => {
                    const existing = findDuplicate(result)
                    const title  = getTitle(result)
                    const author = getAuthor(result)
                    const year   = getYear(result)
                    const cover  = getCover(result)

                    return (
                      <button
                        key={i}
                        className={styles.resultItem}
                        onClick={() => existing ? selectDuplicate(existing) : selectResult(result)}
                      >
                        <div className={styles.resultCover}>
                          {cover
                            ? <img src={cover} alt="" className={styles.resultThumb}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            : <div className={`${styles.resultThumb} ${styles.noThumb}`}>
                                <span className="material-symbols-outlined">menu_book</span>
                              </div>
                          }
                        </div>
                        <div className={styles.resultInfo}>
                          <span className={styles.resultTitle}>{title}</span>
                          <span className={styles.resultMeta}>
                            {author}{year ? ` · ${year}` : ''}
                          </span>
                          <div className={styles.resultBadges}>
                            {result.gb && <span className={styles.sourceBadge}>GB</span>}
                            {result.fl && <span className={styles.sourceBadge}>FL</span>}
                          </div>
                        </div>
                        {existing && (
                          <span className={`${styles.dupBadge} ${styles[`dup_${existing.status}`]}`}>
                            ✓ {STATUS_LABELS[existing.status]}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {!searching && query.length >= 2 && results.length === 0 && (
                <p className={styles.noResults}>Nothing found</p>
              )}

              <button className={styles.skipLink} onClick={() => setPhase('form')}>
                Add without search
              </button>
            </div>
          )}

          {/* ── FORM PHASE ───────────────────────────────────── */}
          {phase === 'form' && (
            <>
              {/* Cover + title + author */}
              <div className={styles.topSection}>
                <div className={styles.coverSm}>
                  {form.cover_url
                    ? <img src={form.cover_url} alt="" className={styles.coverSmImg} />
                    : <div className={`${styles.coverSmImg} ${styles.noCoverSm}`}>
                        <span className="material-symbols-outlined">menu_book</span>
                      </div>
                  }
                </div>
                <div className={styles.titleFields}>
                  <input
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                    placeholder="Title"
                  />
                  <input
                    value={form.author}
                    onChange={e => set('author', e.target.value)}
                    placeholder="Author"
                  />
                </div>
              </div>

              {/* Year */}
              <input
                type="number"
                min="1" max="2099"
                value={form.year ?? ''}
                onChange={e => set('year', parseInt(e.target.value) || undefined)}
                placeholder="Year"
              />

              {/* Status chips */}
              <div className={styles.section}>
                <p className={styles.label}>Status</p>
                <div className={styles.chipGroup}>
                  {(Object.keys(STATUS_LABELS) as BookStatus[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      className={`${styles.chip} ${form.status === s ? styles.chipActive : ''}`}
                      data-status={s}
                      onClick={() => set('status', s)}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type chips */}
              <div className={styles.section}>
                <p className={styles.label}>Type</p>
                <div className={styles.chipGroup}>
                  {(Object.keys(TYPE_LABELS) as BookType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.chip} ${form.type === t ? styles.chipActive : ''}`}
                      onClick={() => set('type', form.type === t ? undefined : t)}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Series */}
              <div className={styles.seriesRow}>
                <input
                  value={form.series_name ?? ''}
                  onChange={e => set('series_name', e.target.value || undefined)}
                  placeholder="Series name"
                />
                <input
                  type="number"
                  min="1"
                  value={form.series_order ?? ''}
                  onChange={e => set('series_order', parseInt(e.target.value) || undefined)}
                  placeholder="#"
                  className={styles.seriesOrder}
                />
              </div>

              {/* Container title */}
              <input
                value={form.container_title ?? ''}
                onChange={e => set('container_title', e.target.value || undefined)}
                placeholder="Part of collection (optional)"
              />

              {/* Genres — read-only chips */}
              {form.genres && form.genres.length > 0 && (
                <div className={styles.section}>
                  <p className={styles.label}>Genres</p>
                  <div className={styles.tagChips}>
                    {form.genres.map(g => (
                      <span key={g} className={styles.tagChip}>{g}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources */}
              {(form.gb_url || form.fl_url || form.wiki_url || linksLoading) && (
                <div className={styles.section}>
                  <p className={styles.label}>
                    Sources
                    {linksLoading && <span className={styles.linksSpinner} />}
                  </p>
                  <div className={styles.sourceLinks}>
                    {form.gb_url && (
                      <a href={form.gb_url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                        <span>Google Books</span>
                        <span className="material-symbols-outlined">open_in_new</span>
                      </a>
                    )}
                    {form.fl_url && (
                      <a href={form.fl_url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                        <span>FantLab</span>
                        <span className="material-symbols-outlined">open_in_new</span>
                      </a>
                    )}
                    {form.wiki_url && (
                      <a href={form.wiki_url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                        <span>Wikipedia</span>
                        <span className="material-symbols-outlined">open_in_new</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {saveError && <p className={styles.error}>{saveError}</p>}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          {phase === 'form' && (
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Add book'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
