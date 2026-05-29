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

export default function FilterPanel() {
  const { filters, setFilters, clearFilters, activeFilterCount } = useBooks()

  return (
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

      {activeFilterCount > 0 && (
        <button className={styles.clearBtn} onClick={clearFilters}>
          Clear all filters
        </button>
      )}

    </div>
  )
}
