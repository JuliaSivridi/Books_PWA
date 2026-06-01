import { useMemo } from 'react'
import type { Book } from '../types/book'
import { STATUS_COLORS, TYPE_LABELS } from '../types/book'
import AlphaPicker from './AlphaPicker'
import styles from './BookList.module.css'

export type SortMode = 'title' | 'author' | 'series'

interface Props {
  books:        Book[]
  onEdit:       (b: Book) => void
  alphaOpen:    boolean
  onAlphaClose: () => void
  sortMode:     SortMode
}

type ListItem =
  | { type: 'divider'; letter: string; label: string; alphaAnchor: boolean; count?: number }
  | { type: 'row';     book: Book }

const CYRILLIC = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'

function firstLetter(s: string): string {
  const ch = s[0]?.toUpperCase() ?? ''
  if (/[А-ЯЁ]/.test(ch)) return ch
  if (/[A-Z]/.test(ch))   return ch
  return '#'
}

function letterOrder(l: string): number {
  const ci = CYRILLIC.indexOf(l)
  if (ci >= 0) return ci
  if (/[A-Z]/.test(l)) return 100 + l.charCodeAt(0)
  return 999
}

function scrollToLetter(letter: string) {
  const el = document.getElementById(`alpha-${letter}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function BookList({ books, onEdit, alphaOpen, onAlphaClose, sortMode }: Props) {
  const { items, letters } = useMemo<{ items: ListItem[]; letters: string[] }>(() => {
    const result: ListItem[] = []

    // ── Series mode ──────────────────────────────────────────────────────────
    if (sortMode === 'series') {
      const seriesMap = new Map<string, Book[]>()
      const noSeries:  Book[] = []

      for (const b of books) {
        if (b.series_name) {
          const arr = seriesMap.get(b.series_name) ?? []
          arr.push(b)
          seriesMap.set(b.series_name, arr)
        } else {
          noSeries.push(b)
        }
      }

      const seriesNames = [...seriesMap.keys()].sort((a, b) => a.localeCompare(b, 'ru'))
      const seenLetters = new Set<string>()
      const alphaLetters: string[] = []

      for (const name of seriesNames) {
        const letter = firstLetter(name)
        const alphaAnchor = !seenLetters.has(letter)
        if (alphaAnchor) { seenLetters.add(letter); alphaLetters.push(letter) }

        const booksInSeries = seriesMap.get(name)!.sort((a, b) => {
          const ao = a.series_order ?? 999, bo = b.series_order ?? 999
          return ao !== bo ? ao - bo : a.title.localeCompare(b.title, 'ru')
        })

        result.push({ type: 'divider', letter, label: name, alphaAnchor, count: booksInSeries.length })
        for (const book of booksInSeries) result.push({ type: 'row', book })
      }

      if (noSeries.length > 0) {
        noSeries.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
        result.push({ type: 'divider', letter: '#', label: 'No series', alphaAnchor: false })
        for (const book of noSeries) result.push({ type: 'row', book })
      }

      const letters = alphaLetters.sort((a, b) => letterOrder(a) - letterOrder(b))
      return { items: result, letters }
    }

    // ── Title / Author modes ─────────────────────────────────────────────────
    const sorted = [...books].sort((a, b) => {
      if (sortMode === 'author') {
        const cmp = a.author.localeCompare(b.author, 'ru')
        return cmp !== 0 ? cmp : a.title.localeCompare(b.title, 'ru')
      }
      const cmp = a.title.localeCompare(b.title, 'ru')
      return cmp !== 0 ? cmp : a.author.localeCompare(b.author, 'ru')
    })

    const map: Record<string, Book[]> = {}
    for (const b of sorted) {
      const l = firstLetter(sortMode === 'author' ? b.author : b.title)
      if (!map[l]) map[l] = []
      map[l].push(b)
    }

    const groupLetters = Object.keys(map).sort((a, b) => letterOrder(a) - letterOrder(b))
    for (const letter of groupLetters) {
      result.push({ type: 'divider', letter, label: letter, alphaAnchor: true })
      for (const book of map[letter]) result.push({ type: 'row', book })
    }
    return { items: result, letters: groupLetters }
  }, [books, sortMode])

  return (
    <>
      {alphaOpen && (
        <AlphaPicker
          letters={letters}
          onSelect={letter => { scrollToLetter(letter); onAlphaClose() }}
          onClose={onAlphaClose}
        />
      )}

      <div>
        {items.map((item, i) => {
          if (item.type === 'divider') {
            return (
              <div
                key={`div-${item.letter}-${item.label}`}
                id={item.alphaAnchor ? `alpha-${item.letter}` : undefined}
                className={styles.divider}
              >
                <span className={styles.dividerLetter}>{item.label}</span>
                {item.count != null && (
                  <span className={styles.dividerCount}>{item.count}</span>
                )}
                <span className={styles.dividerLine} />
              </div>
            )
          }

          const b = item.book
          const statusColor = STATUS_COLORS[b.status]

          return (
            <div key={`row-${b.id}-${i}`} className={styles.row} onClick={() => onEdit(b)}>

              {/* Cover */}
              <div className={styles.coverWrap}>
                {b.cover_url
                  ? <img src={b.cover_url} alt="" className={styles.cover} loading="lazy" />
                  : <div className={`${styles.cover} ${styles.noCover}`}>
                      <span className="material-symbols-outlined">menu_book</span>
                    </div>
                }
                <span className={styles.statusDot} style={{ background: statusColor }} />
              </div>

              {/* Info */}
              <div className={styles.info}>
                <span className={styles.title}>{b.title}</span>
                <span className={styles.author}>{b.author}</span>

                {(b.year || b.type || (sortMode === 'series' && b.series_order != null)) && (
                  <span className={styles.meta}>
                    {sortMode === 'series' && b.series_order != null && (
                      <span>#{b.series_order}</span>
                    )}
                    {b.year  && <span>{b.year}</span>}
                    {b.type  && <span>{TYPE_LABELS[b.type]}</span>}
                  </span>
                )}

                {sortMode !== 'series' && b.series_name && (
                  <span className={styles.series}>
                    {b.series_name}
                    {b.series_order != null && ` · #${b.series_order}`}
                  </span>
                )}

                {(b.gb_url || b.fl_url || b.wiki_url) && (
                  <div className={styles.links} onClick={e => e.stopPropagation()}>
                    {b.gb_url   && <a href={b.gb_url}   target="_blank" rel="noreferrer" className={styles.link}>GB</a>}
                    {b.fl_url   && <a href={b.fl_url}   target="_blank" rel="noreferrer" className={styles.link}>FL</a>}
                    {b.wiki_url && <a href={b.wiki_url} target="_blank" rel="noreferrer" className={styles.link}>Wiki</a>}
                  </div>
                )}
              </div>

            </div>
          )
        })}
      </div>
    </>
  )
}
