import { useEffect, useMemo, useRef, useState } from 'react'
import { useBooks } from '../context/BooksContext'
import { useAuth } from '../context/AuthContext'
import SettingsModal from './SettingsModal'
import FilterPanel from './FilterPanel'
import styles from './Header.module.css'

type SortMode = 'title' | 'author' | 'series'

interface Props {
  onLogoClick:       () => void
  onStatsClick:      () => void
  onHelpClick:       () => void
  onFeedbackClick:   () => void
  sortMode:          SortMode
  onSortModeChange:  (m: SortMode) => void
  inListView:        boolean
  /** When set, the header shows "back arrow + title + avatar" instead of logo/search/filters */
  overlayTitle?:     string
  onOverlayBack?:    () => void
}

export default function Header({ onLogoClick, onStatsClick, onHelpClick, onFeedbackClick, sortMode, onSortModeChange, inListView, overlayTitle, onOverlayBack }: Props) {
  const { query, setQuery, activeFilterCount, filtered } = useBooks()

  const counts = useMemo(() => ({
    title:  filtered.length,
    author: new Set(filtered.map(b => b.author)).size,
    series: new Set(filtered.filter(b => b.series_name).map(b => b.series_name)).size,
  }), [filtered])
  const { user, signOut } = useAuth()
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [filterOpen,   setFilterOpen]   = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <>
      <header className={styles.header}>

        <div className={styles.top}>
          {overlayTitle ? (
            <>
              <button className={styles.overlayBack} onClick={onOverlayBack} title="Back to list">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className={styles.overlayTitle}>{overlayTitle}</span>
            </>
          ) : (
            <>
              <button className={styles.logo} onClick={onLogoClick} title="Jump to letter">
                <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} width={26} height={26} alt="" />
                <span>Books</span>
              </button>

              <div className={styles.search}>
                <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
                <input
                  type="search"
                  placeholder="Search by title, author, series, genre…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>

              <button
                className={`${styles.filterBtn} ${filterOpen || activeFilterCount > 0 ? styles.filterBtnActive : ''}`}
                onClick={() => setFilterOpen(o => !o)}
                title="Filters"
                aria-expanded={filterOpen}
              >
                <span className="material-symbols-outlined">tune</span>
                {activeFilterCount > 0 && (
                  <span className={styles.filterBadge}>{activeFilterCount}</span>
                )}
              </button>
            </>
          )}

          <div className={styles.userWrap} ref={menuRef}>
            <button
              className={styles.avatarBtn}
              onClick={() => setMenuOpen(o => !o)}
              title={user?.name ?? 'Account'}
            >
              {user?.picture
                ? <img src={user.picture} alt={user?.name ?? ''} className={styles.avatarImg} referrerPolicy="no-referrer" />
                : <span className={styles.avatarFallback}>{user?.name?.[0]?.toUpperCase() ?? '?'}</span>
              }
            </button>

            {menuOpen && (
              <div className={styles.menu} role="menu">
                <div className={styles.menuHeader}>
                  <span className={styles.menuName}>{user?.name}</span>
                  <span className={styles.menuEmail}>{user?.email}</span>
                </div>
                <div className={styles.menuDivider} />
                <button
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onStatsClick() }}
                >
                  <span className="material-symbols-outlined">bar_chart</span>
                  Statistics
                </button>
                <button
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); setShowSettings(true) }}
                >
                  <span className="material-symbols-outlined">settings</span>
                  Settings
                </button>
                <button
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onHelpClick() }}
                >
                  <span className="material-symbols-outlined">help</span>
                  Help
                </button>
                <button
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onFeedbackClick() }}
                >
                  <span className="material-symbols-outlined">chat</span>
                  Feedback
                </button>
                <div className={styles.menuDivider} />
                <button
                  className={`${styles.menuItem} ${styles.menuSignOut}`}
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); signOut() }}
                >
                  <span className="material-symbols-outlined">logout</span>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {!overlayTitle && inListView && (
          <div className={styles.tabRow}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${sortMode === 'title'  ? styles.tabActive : ''}`}
                onClick={() => onSortModeChange('title')}
              >Books <span className={styles.tabCount}>{counts.title}</span></button>
              <button
                className={`${styles.tab} ${sortMode === 'author' ? styles.tabActive : ''}`}
                onClick={() => onSortModeChange('author')}
              >Authors <span className={styles.tabCount}>{counts.author}</span></button>
              <button
                className={`${styles.tab} ${sortMode === 'series' ? styles.tabActive : ''}`}
                onClick={() => onSortModeChange('series')}
              >Series <span className={styles.tabCount}>{counts.series}</span></button>
            </div>
          </div>
        )}

      </header>

      {!overlayTitle && (
        <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
