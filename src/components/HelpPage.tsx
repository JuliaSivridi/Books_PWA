import pageStyles from './StatsPage.module.css'

const SECTIONS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Basics',
    items: [
      ['Add a book', 'Tap +, search Google Books and FantLab at once, pick a result — cover, author, year, genres and source links fill in automatically. Or "Add without search" to enter manually.'],
      ['Edit', 'Tap any book to edit its status, type, series and links.'],
      ['Status dot', 'The colored dot on the cover shows reading status — green = read, orange = want (same colors as the status chips).'],
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

export default function HelpPage() {
  return (
    <div className={pageStyles.page}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 32px' }}>
        {SECTIONS.map(s => (
          <section key={s.title} style={{ marginBottom: 22 }}>
            <p style={{
              fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em',
              textTransform: 'uppercase', color: 'var(--text-muted, #9ca3af)', marginBottom: 8,
            }}>{s.title}</p>
            {s.items.map(([term, text]) => (
              <div key={term} style={{ marginBottom: 12 }}>
                <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{term}</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #9ca3af)', marginTop: 2, lineHeight: 1.45 }}>{text}</p>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
