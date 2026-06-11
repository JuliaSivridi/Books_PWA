import { useEffect, useState } from 'react'
import { initAuth, onAuthChange } from './services/auth'
import { findOrCreateBooksFile } from './services/drive'
import { AuthProvider } from './context/AuthContext'
import { BooksProvider, useBooks } from './context/BooksContext'
import LoginPage from './components/LoginPage'
import Header from './components/Header'
import BookGrid from './components/BookGrid'
import StatsPage from './components/StatsPage'
import HelpPage from './components/HelpPage'
import FeedbackPage from './components/FeedbackPage'
import styles from './App.module.css'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  localStorage.getItem('books_google_client_id') || ''

type Phase    = 'loading' | 'login' | 'ready'
type View     = 'list' | 'stats' | 'help' | 'feedback'
type SortMode = 'title' | 'author' | 'series'

function MainContent() {
  const { load } = useBooks()
  const [view,      setView]      = useState<View>('list')
  const [alphaOpen, setAlphaOpen] = useState(false)
  const [sortMode,  setSortMode]  = useState<SortMode>('title')

  useEffect(() => { load() }, [load])

  function handleLogoClick() {
    if (view !== 'list') setView('list')
    else setAlphaOpen(o => !o)
  }

  return (
    <>
      {/* Help/Feedback are full-screen: their own "back + title" row replaces the main header */}
      {(view === 'list' || view === 'stats') && (
        <Header
          onLogoClick={handleLogoClick}
          onStatsClick={() => setView('stats')}
          onHelpClick={() => setView('help')}
          onFeedbackClick={() => setView('feedback')}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          inListView={view === 'list'}
        />
      )}
      {view === 'list'     ? <BookGrid alphaOpen={alphaOpen} onAlphaClose={() => setAlphaOpen(false)} sortMode={sortMode} />
        : view === 'stats' ? <StatsPage onBack={() => setView('list')} />
        : view === 'help'  ? <HelpPage onBack={() => setView('list')} />
        : <FeedbackPage onBack={() => setView('list')} />
      }
    </>
  )
}

function AppInner() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [driveError, setDriveError] = useState('')

  useEffect(() => {
    const unsub = onAuthChange(async isAuth => {
      if (!isAuth) { setPhase('login'); return }
      try {
        await findOrCreateBooksFile()
        setPhase('ready')
      } catch (e) {
        setDriveError(String(e))
        setPhase('login')
      }
    })

    if (!CLIENT_ID) {
      setDriveError('Не задан VITE_GOOGLE_CLIENT_ID')
      setPhase('login')
    } else {
      initAuth(CLIENT_ID)
    }

    return unsub
  }, [])

  if (phase === 'loading') {
    return (
      <div className={styles.splash}>
        <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} width={64} height={64} alt="" />
        <div className={styles.splashSpinner} />
      </div>
    )
  }

  if (phase === 'login') return <LoginPage error={driveError} />

  return <MainContent />
}

export default function App() {
  return (
    <AuthProvider>
      <BooksProvider>
        <AppInner />
      </BooksProvider>
    </AuthProvider>
  )
}
