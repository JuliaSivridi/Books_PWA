import { useRef } from 'react'
import styles from './SettingsModal.module.css'

interface Props { onClose: () => void }

const SECTIONS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Basics',
    items: [
      ['Add a book', 'Tap +, search Google Books and FantLab at once, pick a result — cover, author, year, genres and source links fill in automatically. Or "Add without search" to enter manually.'],
      ['Edit', 'Tap any book to edit its status, type, series and links.'],
      ['Status dot', 'The colored dot on the cover shows reading status — green = read, orange = want, and so on (same colors as the status chips).'],
      ['Tabs', 'Switch between Books, Authors and Series; the number shows how many match the current search and filters.'],
    ],
  },
  {
    title: 'Find & organize',
    items: [
      ['Search', 'Search by title, author, series or genre.'],
      ['Filters', 'The tune icon opens filters: status, type and genre. The badge shows how many filters are active.'],
      ['Jump to letter', 'Tap the Books logo to jump to a letter in the list.'],
      ['Statistics', 'Open Statistics from the avatar menu for breakdowns by status, type, author, genre, decade and series.'],
    ],
  },
  {
    title: 'Data',
    items: [
      ['Where is my data?', 'In a Google Sheets file (db_books) in your own Google Drive — open and inspect it any time.'],
      ['Switch file', 'In Settings you can point the app at a different spreadsheet.'],
    ],
  },
]

export default function HelpModal({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  return (
    <div className={styles.overlay} ref={overlayRef} onClick={e => e.target === overlayRef.current && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Help</h2>
          <button className={styles.close} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={styles.body}>
          {SECTIONS.map(s => (
            <div className={styles.section} key={s.title}>
              <p className={styles.sectionLabel}>{s.title}</p>
              {s.items.map(([term, text]) => (
                <div key={term} style={{ marginBottom: 10 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{term}</p>
                  <p className={styles.hint} style={{ marginTop: 2 }}>{text}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.footer}>
          <button className={styles.saveBtn} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}
