import { useRef, useState } from 'react'
import { getGBKey } from '../services/googlebooks'
import { getSheetId, getSheetName, setSheetFile } from '../services/drive'
import { openSpreadsheetPicker } from '../services/picker'
import { PICKER_API_KEY, PICKER_APP_ID } from '../App'
import { useBooks } from '../context/BooksContext'
import styles from './SettingsModal.module.css'

interface Props { onClose: () => void }

export default function SettingsModal({ onClose }: Props) {
  const { load } = useBooks()
  const [gbKey, setGbKey] = useState(getGBKey())
  const [saved, setSaved] = useState(false)
  const [pickerError, setPickerError] = useState('')

  const currentId   = getSheetId()
  const currentName = getSheetName()
  const overlayRef  = useRef<HTMLDivElement>(null)

  // Native Google Picker: picking a file also grants the app access to it
  // (we only have the drive.file scope — the rest of Drive is invisible).
  async function handleOpenPicker() {
    setPickerError('')
    try {
      const file = await openSpreadsheetPicker(PICKER_API_KEY, PICKER_APP_ID)
      if (!file || file.id === currentId) return
      setSheetFile(file.id, file.name)
      try { await load() } catch (e) { console.error(e) }
      onClose()
    } catch (e) {
      setPickerError(String(e))
    }
  }

  function handleSave() {
    localStorage.setItem('gb_key', gbKey.trim())
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 700)
  }

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && onClose()}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Settings</h2>
          <button className={styles.close} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className={styles.body}>

          {/* Spreadsheet picker */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Google Spreadsheet</p>
            <div className={styles.fileRow}>
              <span className={`material-symbols-outlined ${styles.fileIcon}`}>table_chart</span>
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{currentName || 'No file connected'}</span>
                <span className={styles.fileDesc}>Books data source</span>
              </div>
              <button
                className={styles.changeBtn}
                onClick={handleOpenPicker}
              >
                Change
              </button>
            </div>

            {pickerError && <div className={styles.pickerError}>{pickerError}</div>}
          </div>

          {/* Google Books API Key */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Google Books API Key</p>
            <input
              type="password"
              value={gbKey}
              onChange={e => setGbKey(e.target.value)}
              placeholder="Your key from console.cloud.google.com"
              autoComplete="off"
            />
            <p className={styles.hint}>
              Optional. Without a key, Books API is limited to 100 requests/day.
            </p>
          </div>

        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
