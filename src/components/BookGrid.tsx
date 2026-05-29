import { useState } from 'react'
import { useBooks } from '../context/BooksContext'
import BookList from './BookList'
import AddBookModal from './AddBookModal'
import type { Book } from '../types/book'
import styles from './BookGrid.module.css'

interface Props { alphaOpen: boolean; onAlphaClose: () => void }

export default function BookGrid({ alphaOpen, onAlphaClose }: Props) {
  const { filtered, loading, error } = useBooks()
  const [editing, setEditing] = useState<Book | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  if (loading) return (
    <div className={styles.center}>
      <div className={styles.spinner} />
    </div>
  )

  if (error) return (
    <div className={styles.center}>
      <p className={styles.error}>{error}</p>
    </div>
  )

  return (
    <div className={styles.wrap}>

      {filtered.length === 0 && (
        <div className={styles.empty}>
          <span className={`material-symbols-outlined ${styles.emptyIcon}`}>menu_book</span>
          <p>No books found</p>
          <button className={styles.addFirst} onClick={() => setShowAdd(true)}>
            Add your first book
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <BookList books={filtered} onEdit={setEditing} alphaOpen={alphaOpen} onAlphaClose={onAlphaClose} />
      )}

      <button className={styles.fab} onClick={() => setShowAdd(true)} title="Add book">
        <span className="material-symbols-outlined">add</span>
      </button>

      {showAdd  && <AddBookModal                onClose={() => setShowAdd(false)} />}
      {editing  && <AddBookModal book={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
