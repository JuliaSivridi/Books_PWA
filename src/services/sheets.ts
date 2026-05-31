/**
 * Google Sheets API v4 — CRUD for books.
 *
 * Columns A–O (15 total):
 *   id | title | author | year | status | type |
 *   cover_url | gb_id | gb_url | fl_work_id | fl_url | wiki_url |
 *   genres | series_name | series_order
 */

import type { Book, BookStatus, BookType } from '../types/book'
import { refreshTokenIfNeeded } from './auth'
import { getSheetId } from './drive'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const SHEET_NAME  = 'Books'
const HEADERS = [
  'id', 'title', 'author', 'year', 'status', 'type',
  'cover_url', 'gb_id', 'gb_url', 'fl_work_id', 'fl_url', 'wiki_url',
  'genres', 'series_name', 'series_order',
]

async function api(path: string, method: string, body?: object): Promise<Response> {
  const token = await refreshTokenIfNeeded()
  if (!token) throw new Error('Not authorized')
  const id = getSheetId()
  if (!id) throw new Error('Sheet not found')

  const res = await fetch(`${SHEETS_BASE}/${id}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } })?.error?.message || `Sheets API ${res.status}`)
  }
  return res
}

function parseArr(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function rowToBook(row: string[], rowIndex: number): Book {
  return {
    id:               row[0]  || String(rowIndex),
    title:            row[1]  || '',
    author:           row[2]  || '',
    year:             parseInt(row[3]) || undefined,
    status:           (row[4] as BookStatus) || 'want',
    type:             (row[5] as BookType)   || undefined,
    cover_url:        row[6]  || undefined,
    gb_id:            row[7]  || undefined,
    gb_url:           row[8]  || undefined,
    fl_work_id:       row[9]  || undefined,
    fl_url:           row[10] || undefined,
    wiki_url:         row[11] || undefined,
    genres:           parseArr(row[12]),
    series_name:      row[13] || undefined,
    series_order:     row[14] ? parseInt(row[14]) : undefined,
    _row: rowIndex + 2,
  }
}

function bookToRow(b: Book): string[] {
  return [
    b.id,
    b.title,
    b.author,
    b.year != null ? String(b.year) : '',
    b.status,
    b.type         || '',
    b.cover_url    || '',
    b.gb_id        || '',
    b.gb_url       || '',
    b.fl_work_id   || '',
    b.fl_url       || '',
    b.wiki_url     || '',
    b.genres?.length    ? JSON.stringify(b.genres) : '',
    b.series_name       || '',
    b.series_order != null ? String(b.series_order) : '',
  ]
}

export async function initializeSheet(): Promise<void> {
  const headRes  = await api(`/values/${SHEET_NAME}!A1:A1`, 'GET')
  const headData = await headRes.json()

  if (!headData.values || headData.values[0]?.[0] !== 'id') {
    await api(
      `/values/${SHEET_NAME}!A1:O1?valueInputOption=RAW`,
      'PUT',
      { values: [HEADERS] },
    )
  }
}

export async function fetchBooks(): Promise<Book[]> {
  const res  = await api(`/values/${SHEET_NAME}!A:O`, 'GET')
  const data = await res.json()
  if (!data.values || data.values.length <= 1) return []
  return (data.values as string[][])
    .slice(1)
    .map((row, i) => rowToBook(row, i))
    .filter(b => b.id && b.title)
}

export async function addBook(book: Book): Promise<Book> {
  const res  = await api(
    `/values/${SHEET_NAME}!A:O:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    'POST',
    { values: [bookToRow(book)] },
  )
  const data  = await res.json()
  const range: string = data.updates?.updatedRange || ''
  const match = range.match(/!A(\d+):/)
  return { ...book, _row: match ? parseInt(match[1]) : undefined }
}

export async function updateBook(book: Book): Promise<void> {
  if (!book._row) throw new Error('Row number unknown')
  await api(
    `/values/${SHEET_NAME}!A${book._row}:O${book._row}?valueInputOption=RAW`,
    'PUT',
    { values: [bookToRow(book)] },
  )
}

export async function deleteBook(book: Book): Promise<void> {
  if (!book._row) throw new Error('Row number unknown')
  const token = await refreshTokenIfNeeded()
  if (!token) throw new Error('Not authorized')
  const id = getSheetId()

  const metaRes = await fetch(`${SHEETS_BASE}/${id}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const meta  = await metaRes.json()
  const sheet = meta.sheets?.find(
    (s: { properties: { title: string; sheetId: number } }) =>
      s.properties.title === SHEET_NAME,
  )
  if (!sheet) throw new Error('Books sheet not found')

  await api(':batchUpdate', 'POST', {
    requests: [{
      deleteDimension: {
        range: {
          sheetId:    sheet.properties.sheetId,
          dimension:  'ROWS',
          startIndex: book._row - 1,
          endIndex:   book._row,
        },
      },
    }],
  })
}
