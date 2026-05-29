import { useMemo } from 'react'
import type { Book } from '../types/book'
import { STATUS_COLORS, TYPE_LABELS } from '../types/book'
import AlphaPicker from './AlphaPicker'
import styles from './BookList.module.css'

interface Props {
  books:        Book[]
  onEdit:       (b: Book) => void
  alphaOpen:    boolean
  onAlphaClose: () => void
}

type ListItem =
  | { type: 'divider'; letter: string }
  | { type: 'row';     book: Book }

const CYRILLIC = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'

function authorFirstLetter(author: string): string {
  const ch = author[0]?.toUpperCase() ?? ''
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

export default function BookList({ books, onEdit, alphaOpen, onAlphaClose }: Props) {
  const { items, letters } = useMemo<{ items: ListItem[]; letters: string[] }>(() => {
    const sorted = [...books].sort((a, b) => {
      const cmp = a.author.localeCompare(b.author, 'ru')
      return cmp !== 0 ? cmp : a.title.localeCompare(b.title, 'ru')
    })

    const map: Record<string, Book[]> = {}
    for (const b of sorted) {
      const l = authorFirstLetter(b.author)
      if (!map[l]) map[l] = []
      map[l].push(b)
    }

    const groupLetters = Object.keys(map).sort((a, b) => letterOrder(a) - letterOrder(b))
    const result: ListItem[] = []
    for (const letter of groupLetters) {
      result.push({ type: 'divider', letter })
      for (const book of map[letter]) result.push({ type: 'row', book })
    }
    return { items: result, letters: groupLetters }
  }, [books])

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
                key={`div-${item.letter}`}
                id={`alpha-${item.letter}`}
                className={styles.divider}
              >
                <span className={styles.dividerLetter}>{item.letter}</span>
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

                {(b.year || b.type) && (
                  <span className={styles.meta}>
                    {b.year  && <span>{b.year}</span>}
                    {b.type  && <span>{TYPE_LABELS[b.type]}</span>}
                  </span>
                )}

                {b.series_name && (
                  <span className={styles.series}>
                    {b.series_name}
                    {b.series_order != null && ` · #${b.series_order}`}
                  </span>
                )}

                {b.container_title && (
                  <span className={styles.container}>из: {b.container_title}</span>
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
