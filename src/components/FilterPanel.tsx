import { useBooks } from '../context/BooksContext'
import { STATUS_LABELS, TYPE_LABELS } from '../types/book'
import type { BookStatus, BookType } from '../types/book'
import styles from './FilterPanel.module.css'

const STATUS_OPTIONS: { key: BookStatus | 'all'; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'want',    label: STATUS_LABELS.want },
  { key: 'reading', label: STATUS_LABELS.reading },
  { key: 'read',    label: STATUS_LABELS.read },
]

const TYPE_OPTIONS: { key: BookType | 'all'; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'novel',      label: TYPE_LABELS.novel },
  { key: 'story',      label: TYPE_LABELS.story },
  { key: 'novella',    label: TYPE_LABELS.novella },
  { key: 'collection', label: TYPE_LABELS.collection },
  { key: 'other',      label: TYPE_LABELS.other },
]

interface Props {
  open: boolean
  onClose: () => void
}

/** Bottom-sheet filter panel (same pattern as Money/Tasks): backdrop +
 *  slide-up sheet, "Clear all filters" pinned at the top, filters apply
 *  instantly — no Apply button (family convention). */
export default function FilterPanel({ open, onClose }: Props) {
  const { filters, setFilters, clearFilters, activeFilterCount, allGenres } = useBooks()

  function toggleGenre(g: string) {
    const next = filters.genres.includes(g)
      ? filters.genres.filter(x => x !== g)
      : [...filters.genres, g]
    setFilters({ genres: next })
  }

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}

      <div className={`${styles.sheet} ${open ? styles.sheetOpen : ''}`}>

        <div className={styles.handleRow}>
          <div className={styles.handle} />
        </div>

        {activeFilterCount > 0 && (
          <div className={styles.clearWrap}>
            <button className={styles.clearBtn} onClick={() => { clearFilters(); onClose() }}>
              Clear all filters
            </button>
          </div>
        )}

        <div className={styles.panel}>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Status</span>
        <div className={styles.chips}>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.key}
              className={`${styles.chip} ${filters.status === s.key ? styles.chipActive : ''}`}
              data-status={s.key}
              onClick={() => setFilters({ status: s.key })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Type</span>
        <div className={styles.chips}>
          {TYPE_OPTIONS.map(t => (
            <button
              key={t.key}
              className={`${styles.chip} ${filters.type === t.key ? styles.chipActive : ''}`}
              onClick={() => setFilters({ type: t.key })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {allGenres.length > 0 && (
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Genre</span>
          <div className={`${styles.chips} ${styles.chipsGenre}`}>
            {allGenres.map(g => (
              <button
                key={g}
                className={`${styles.chip} ${filters.genres.includes(g) ? styles.chipActive : ''}`}
                onClick={() => toggleGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

        </div>
      </div>
    </>
  )
}
