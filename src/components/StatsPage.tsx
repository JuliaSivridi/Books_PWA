import { useMemo, useState } from 'react'
import type { Book } from '../types/book'
import { STATUS_LABELS, TYPE_LABELS } from '../types/book'
import { useBooks } from '../context/BooksContext'
import styles from './StatsPage.module.css'

type Dim = 'status' | 'type' | 'author' | 'genre' | 'decade' | 'series'

const DIMS: { key: Dim; label: string }[] = [
  { key: 'status', label: 'Status'  },
  { key: 'type',   label: 'Type'    },
  { key: 'author', label: 'Author'  },
  { key: 'genre',  label: 'Genre'   },
  { key: 'decade', label: 'Decade'  },
  { key: 'series', label: 'Series'  },
]

const PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#3b82f6',
  '#8b5cf6', '#22d3ee', '#84cc16', '#f97316', '#ec4899',
  '#14b8a6', '#a78bfa', '#fb923c', '#4ade80', '#e11d48',
]
const OTHERS_COLOR = '#94a3b8'
const TOP_N = 15

interface Slice { label: string; count: number; color: string }
interface SlicesResult { slices: Slice[]; uniqueCount: number }

function computeSlices(books: Book[], dim: Dim): SlicesResult {
  const counts: Record<string, number> = {}
  let uniqueCount = 0

  for (const b of books) {
    let keys: string[]
    switch (dim) {
      case 'status': keys = [STATUS_LABELS[b.status]]; break
      case 'type':   keys = b.type ? [TYPE_LABELS[b.type]] : []; break
      case 'author': keys = b.author ? [b.author] : []; break
      case 'genre':  keys = b.genres ?? []; break
      case 'decade': {
        if (!b.year) continue
        keys = [`${Math.floor(b.year / 10) * 10}s`]
        break
      }
      case 'series': keys = b.series_name ? [b.series_name] : []; break
    }
    const validKeys = keys.filter(k => !!k)
    if (validKeys.length > 0) uniqueCount++
    for (const k of validKeys) {
      counts[k] = (counts[k] ?? 0) + 1
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const top    = sorted.slice(0, TOP_N)
  const rest   = sorted.slice(TOP_N).reduce((s, [, n]) => s + n, 0)

  const slices: Slice[] = top.map(([label, count], i) => ({
    label, count, color: PALETTE[i % PALETTE.length],
  }))
  if (rest > 0) slices.push({ label: 'Others', count: rest, color: OTHERS_COLOR })
  return { slices, uniqueCount }
}

function sectorPath(
  cx: number, cy: number,
  R: number, r: number,
  a1: number, a2: number,
): string {
  const [c1, s1] = [Math.cos(a1), Math.sin(a1)]
  const [c2, s2] = [Math.cos(a2), Math.sin(a2)]
  const large = a2 - a1 > Math.PI ? 1 : 0
  return [
    `M ${cx + R*c1} ${cy + R*s1}`,
    `A ${R} ${R} 0 ${large} 1 ${cx + R*c2} ${cy + R*s2}`,
    `L ${cx + r*c2} ${cy + r*s2}`,
    `A ${r} ${r} 0 ${large} 0 ${cx + r*c1} ${cy + r*s1}`,
    'Z',
  ].join(' ')
}

function DonutChart({ slices, uniqueCount }: { slices: Slice[]; uniqueCount: number }) {
  const total = slices.reduce((s, x) => s + x.count, 0)
  if (total === 0) return null

  let angle = -Math.PI / 2
  const sectors = slices.map(slice => {
    const sweep = (slice.count / total) * 2 * Math.PI
    const start = angle
    angle += sweep
    return { slice, start, end: angle }
  })

  const cx = 140, cy = 140, R = 125, r = 68

  return (
    <svg viewBox="0 0 280 280" className={styles.svg}>
      {sectors.map(({ slice, start, end }, i) => (
        <path
          key={i}
          d={sectorPath(cx, cy, R, r, start, end)}
          fill={slice.color}
          stroke="var(--surface)"
          strokeWidth="2.5"
        />
      ))}
      <text x={cx} y={cy - 10} className={styles.svgTotal}>{uniqueCount}</text>
      <text x={cx} y={cy + 16} className={styles.svgLabel}>books</text>
    </svg>
  )
}

interface Props { onBack: () => void }

export default function StatsPage({ onBack }: Props) {
  const { books } = useBooks()
  const [dim, setDim] = useState<Dim>('status')

  const { slices, uniqueCount } = useMemo(() => computeSlices(books, dim), [books, dim])

  return (
    <div className={styles.page}>

      <div className={styles.titleRow}>
        <button className={styles.backBtn} onClick={onBack} title="Back to list">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className={styles.title}>Statistics</h1>
        <span className={styles.bookCount}>{books.length} books</span>
      </div>

      <div className={styles.dimRow}>
        {DIMS.map(d => (
          <button
            key={d.key}
            className={`${styles.dimBtn} ${dim === d.key ? styles.dimBtnActive : ''}`}
            onClick={() => setDim(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {slices.length > 0 ? (
        <div className={styles.chartWrap}>
          <DonutChart slices={slices} uniqueCount={uniqueCount} />

          <div className={styles.legend}>
            {slices.map((s, i) => (
              <div key={i} className={styles.legendRow}>
                <span className={styles.legendDot} style={{ background: s.color }} />
                <span className={styles.legendLabel}>{s.label}</span>
                <span className={styles.legendCount}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className={styles.empty}>No data for this dimension</p>
      )}

    </div>
  )
}
