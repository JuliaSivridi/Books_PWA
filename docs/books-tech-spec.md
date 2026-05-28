# Books PWA — Technical Specification

**Version:** 1.1  
**Date:** May 2026  
**Based on:** `JuliaSivridi/Films_PWA` architecture

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Data Model](#4-data-model)
5. [External APIs](#5-external-apis)
6. [Services Layer](#6-services-layer)
7. [State Management](#7-state-management)
8. [Component Architecture](#8-component-architecture)
9. [Navigation & Routing](#9-navigation--routing)
10. [Styling System](#10-styling-system)
11. [Build & Deployment](#11-build--deployment)
12. [Key Algorithms](#12-key-algorithms)

---

## 1. Overview

Books PWA is a personal book-collection manager built as a Progressive Web App. The user authenticates with Google OAuth 2.0; their book data lives in a private Google Spreadsheet (no custom backend). The app lets the user browse, search, filter, add, edit, and delete books.

**Key design decisions:**

- **No backend server.** All persistence goes directly to Google Sheets API v4.
- **No routing library.** Navigation is modelled as React state (`view: 'list' | 'stats'`).
- **No chart library.** Statistics rendered with raw SVG path math (same as Films PWA).
- **No CSS-in-JS.** Styles live in per-component CSS Modules plus global custom properties.
- **Two search sources in parallel.** When the user searches, both Google Books API and FantLab API are queried simultaneously via `Promise.allSettled`. Results are merged into a single list, deduplicated by author+title.
- **Source badges on each card.** Each book card shows which sources contain this title (GB and/or FL), as clickable links to the corresponding pages.

---

## 2. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 | Strict Mode in `main.tsx` |
| Language | TypeScript 5 | Strict, `moduleResolution: bundler` |
| Build tool | Vite 5 | `react-swc` plugin |
| Styling | CSS Modules + CSS custom properties | Light/dark via `prefers-color-scheme` |
| Icons | Material Symbols Outlined | Loaded from Google Fonts CDN |
| Auth | Google Identity Services (GIS) | Token in memory; profile in `localStorage` |
| Database | Google Sheets API v4 | One spreadsheet, one `Books` sheet |
| Book metadata (primary) | Google Books API v1 | Search, cover images, metadata |
| Book metadata (secondary) | FantLab API v0.9 | Search, work type, FL page link |
| Wikipedia links | Wikidata SPARQL | Lookup by ISBN → ru/en Wikipedia URL |

**Runtime dependencies (`package.json`):**

```
react, react-dom          — ^18
vite, @vitejs/plugin-react-swc, typescript — devDependencies
```

> Virtual scrolling (`@tanstack/react-virtual`) is optional — the personal book collection is unlikely to exceed a few hundred records. Can be added later if needed.

---

## 3. Project Structure

```
Books_PWA/
├── public/
│   ├── icons/icon.svg          # App icon
│   └── manifest.json           # PWA manifest
├── src/
│   ├── main.tsx                # ReactDOM.createRoot, StrictMode
│   ├── App.tsx                 # Root: auth phases, view routing
│   ├── index.css               # Global variables, resets, base styles
│   ├── types/
│   │   └── book.ts             # Book interface, BookStatus, BookType, constants
│   ├── context/
│   │   ├── AuthContext.tsx     # Thin wrapper: authenticated, user, signIn, signOut
│   │   └── BooksContext.tsx    # useReducer store: books, filters, CRUD operations
│   ├── services/
│   │   ├── auth.ts             # GIS OAuth2 flow (identical to Films PWA)
│   │   ├── drive.ts            # Drive API: find/create spreadsheet
│   │   ├── sheets.ts           # Sheets API v4: CRUD on rows
│   │   ├── googlebooks.ts      # Google Books search + cover URLs
│   │   ├── fantlab.ts          # FantLab search + work page URL
│   │   └── wikidata.ts         # Wikidata SPARQL: ISBN → Wikipedia URL
│   └── components/
│       ├── LoginPage.tsx / .module.css
│       ├── Header.tsx / .module.css
│       ├── FilterPanel.tsx / .module.css
│       ├── BookGrid.tsx / .module.css
│       ├── BookList.tsx / .module.css
│       ├── AddBookModal.tsx / .module.css
│       ├── SettingsModal.tsx / .module.css
│       └── StatsPage.tsx / .module.css
├── docs/
│   └── tech-spec.md            # This document
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Data Model

### 4.1 `Book` interface (`src/types/book.ts`)

```typescript
export type BookStatus = 'want' | 'reading' | 'read'

export type BookType =
  | 'novel'       // роман
  | 'story'       // рассказ
  | 'novella'     // повесть
  | 'collection'  // сборник
  | 'other'       // прочее

export interface Book {
  id:               string          // UUID
  title:            string          // Название (как хочет видеть пользователь)
  author:           string          // Автор(ы)
  year?:            number          // Год первой публикации
  status:           BookStatus      // 'want' | 'reading' | 'read'
  type?:            BookType        // Тип произведения
  cover_url?:       string          // Прямой URL обложки (из GB или FL)
  gb_id?:           string          // Google Books volume ID
  gb_url?:          string          // Ссылка на страницу в Google Books
  fl_work_id?:      string          // FantLab work ID
  fl_url?:          string          // Ссылка на страницу в FantLab
  wiki_url?:        string          // Wikipedia URL (ru preferred, en fallback)
  genres?:          string[]        // Жанры (из GB или введённые вручную)
  container_title?: string          // Название сборника (если это рассказ внутри книги)
  series_name?:     string          // Название серии (напр. "Основание")
  series_order?:    number          // Порядковый номер в серии (напр. 1)
  _row?:            number          // 1-based Google Sheets row (not saved)
}

export const STATUS_LABELS: Record<BookStatus, string> = {
  want: 'Want', reading: 'Reading', read: 'Read'
}

export const STATUS_COLORS: Record<BookStatus, string> = {
  want: '#f59e0b', reading: '#3b82f6', read: '#10b981'
}

export const TYPE_LABELS: Record<BookType, string> = {
  novel: 'Роман', story: 'Рассказ', novella: 'Повесть',
  collection: 'Сборник', other: 'Прочее'
}
```

**Примечание по `container_title`:**  
Поле для рассказа внутри сборника. Пример: `title = "Приход ночи"`, `type = 'story'`, `container_title = "Я, Робот"`.

**Примечание по `series_name` / `series_order`:**  
Поля вводятся вручную. Пример: `series_name = "Основание"`, `series_order = 1`. В списке книги одной серии можно отсортировать по `series_order`, чтобы видеть правильный порядок чтения. Поиск по `series_name` работает через общую строку поиска.

### 4.2 Google Sheets Layout

Лист называется `Books`. Строка 1 — заголовки.

| Column | Letter | Field | Notes |
|---|---|---|---|
| 1 | A | id | UUID string |
| 2 | B | title | Название |
| 3 | C | author | Автор |
| 4 | D | year | Integer string |
| 5 | E | status | `want` / `reading` / `read` |
| 6 | F | type | `novel` / `story` / `novella` / `collection` / `other` |
| 7 | G | cover_url | Direct image URL |
| 8 | H | gb_id | Google Books volume ID |
| 9 | I | gb_url | URL string |
| 10 | J | fl_work_id | FantLab work ID |
| 11 | K | fl_url | URL string |
| 12 | L | wiki_url | URL string |
| 13 | M | genres | JSON array string |
| 14 | N | container_title | Free text |
| 15 | O | series_name | Free text |
| 16 | P | series_order | Integer string |

Формат хранения массивов (genres): JSON-сериализованная строка — `["Fantasy","Science Fiction"]`. Функция `parseArr()` — идентична Films PWA.

---

## 5. External APIs

### 5.1 Google Identity Services (GIS)

Идентична Films PWA (см. films-tech-spec §5.1).  
Scopes: `email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly`

### 5.2 Google Sheets API v4

Base URL: `https://sheets.googleapis.com/v4/spreadsheets`

| Operation | Method | Endpoint |
|---|---|---|
| Read all rows | GET | `/{id}/values/Books!A:P` |
| Append row | POST | `/{id}/values/Books!A:P:append?valueInputOption=RAW` |
| Update row | PUT | `/{id}/values/Books!A{row}:P{row}?valueInputOption=RAW` |
| Delete row | POST | `/{id}:batchUpdate` (deleteDimension) |
| Init headers | PUT | `/{id}/values/Books!A1:P1?valueInputOption=RAW` |

### 5.3 Google Books API v1

Base URL: `https://www.googleapis.com/books/v1`

| Endpoint | Purpose |
|---|---|
| `GET /volumes?q={query}&maxResults=8` | Поиск книг по названию и/или автору |
| `GET /volumes/{id}` | Детали тома: ISBN, жанры |

**Формат поискового запроса:**  
`q=intitle:{title}+inauthor:{author}` — если пользователь ввёл оба поля.  
`q={query}` — если ввёл одно поле.

**Объект `GBVolume` (только используемые поля):**

```typescript
interface GBVolume {
  id: string
  volumeInfo: {
    title:          string
    authors?:       string[]
    publishedDate?: string          // "2001" или "2001-03-15"
    imageLinks?: {
      thumbnail:      string        // ~128px обложка
      smallThumbnail: string
    }
    categories?:    string[]
    infoLink:       string          // ссылка на страницу книги в Google Books
    industryIdentifiers?: Array<{
      type:           string        // "ISBN_13" | "ISBN_10"
      identifier:     string
    }>
  }
}
```

API key хранится в `localStorage('gb_key')`, редактируется в Settings.

**Лимит:** 100 запросов/день бесплатно. Для личного трекера достаточно.

### 5.4 FantLab API v0.9

Base URL: `https://api.fantlab.ru`

> **Важно:** API находится в тестовом режиме (до v1.0 возможны изменения). Если FL недоступен — приложение продолжает работу только с Google Books.

| Endpoint | Purpose |
|---|---|
| `GET /searchmain?q={query}&page=1` | Общий поиск (возвращает works, authors, ...) |

**Объект `FLWork` (только используемые поля):**

```typescript
interface FLSearchResult {
  works?: Array<{
    work_id:         number
    work_name:       string
    work_name_orig?: string
    work_year?:      number
    authors:         Array<{ id: number; name: string }>
    work_type_name:  string   // "Роман", "Рассказ", "Сборник", и т.д.
    image?:          string   // URL обложки
  }>
}
```

URL страницы произведения: `https://fantlab.ru/work{work_id}`

**Маппинг `work_type_name` → `BookType`:**

```typescript
const FL_TYPE_MAP: Record<string, BookType> = {
  'Роман':              'novel',
  'Рассказ':            'story',
  'Микрорассказ':       'story',
  'Повесть':            'novella',
  'Сборник':            'collection',
  'Антология':          'collection',
  'Цикл':               'collection',
  'Авторский сборник':  'collection',
}
// Всё остальное → 'other'
```

FantLab не требует API-ключа для публичного поиска.

### 5.5 Wikidata SPARQL

Endpoint: `https://query.wikidata.org/sparql`

Поиск по ISBN-13 (`P957`) — получаем ru.wikipedia.org sitelink (preferred) или en (fallback).

```sparql
SELECT ?item ?ruWiki ?enWiki WHERE {
  ?item wdt:P957 "{isbn13}" .
  OPTIONAL { ?ruWiki schema:about ?item; schema:isPartOf <https://ru.wikipedia.org/> }
  OPTIONAL { ?enWiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
}
LIMIT 1
```

Возвращает `{ wiki_url: string | null }` — предпочитается русская Wikipedia, fallback на английскую.

Вызывается как фоновое обогащение после получения ISBN из `getBookDetails(gb_id)`. Если ISBN не найден в GB — Wikidata не запрашивается.

---

## 6. Services Layer

### 6.1 `auth.ts`

Идентична Films PWA. Функции: `initAuth`, `trySilentSignIn`, `signIn`, `signOut`, `refreshTokenIfNeeded`.

### 6.2 `drive.ts`

```
findOrCreateBooksFile()
  1. Проверить localStorage ('books_sheet_id')
  2. Поиск Drive: name='db_books' AND not trashed
  3. Если не найден: создать новый spreadsheet
  4. Кэшировать в localStorage

listUserSheets()
  → Список Google Sheets файлов пользователя → [{id, name}]
```

### 6.3 `sheets.ts`

```
fetchBooks()
  → GET Books!A:P
  → Пропустить заголовок (строка 0)
  → Каждую строку через rowToBook()

addBook(book)    → POST :append
updateBook(book) → PUT Books!A{_row}:P{_row}
deleteBook(id)   → GET sheetId → POST :batchUpdate deleteDimension
```

**`rowToBook()` mapping:**

```typescript
function rowToBook(row: string[], rowIndex: number): Book {
  return {
    id:               row[0] || String(rowIndex),
    title:            row[1] || '',
    author:           row[2] || '',
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
    container_title:  row[13] || undefined,
    series_name:      row[14] || undefined,
    series_order:     row[15] ? parseInt(row[15]) : undefined,
    _row:             rowIndex + 2,
  }
}
```

### 6.4 `googlebooks.ts`

```
searchBooks(query: string): Promise<GBVolume[]>
  → maxResults=8

getBookDetails(gb_id: string): Promise<{ isbn13: string | null, categories: string[] }>
  → GET /volumes/{id}
  → Извлечь ISBN_13 из industryIdentifiers[]
  → Вернуть isbn13 + categories

getCoverUrl(imageLinks, size): string
  → thumbnail или smallThumbnail
  → Заменить http:// на https://
  → Если нет — вернуть undefined (показывается placeholder)
```

### 6.5 `fantlab.ts`

```
searchBooks(query: string): Promise<FLSearchResult>
  → GET /searchmain?q={encodeURIComponent(query)}&page=1
  → При любой ошибке: вернуть { works: [] } без throw

getWorkUrl(work_id: number): string
  → 'https://fantlab.ru/work' + work_id

mapWorkType(work_type_name: string): BookType
  → FL_TYPE_MAP lookup, fallback 'other'
```

**Принцип мягкой деградации:** ошибка FantLab не блокирует работу приложения.

### 6.6 `wikidata.ts`

```
lookupByIsbn(isbn13: string): Promise<{ wiki_url: string | null }>
  → SPARQL запрос к query.wikidata.org
  → Предпочесть ru.wikipedia.org, fallback en.wikipedia.org
  → При ошибке: вернуть { wiki_url: null } без throw
```

---

## 7. State Management

### 7.1 `AuthContext`

Идентична Films PWA. Экспортирует `{ authenticated, user, signIn, signOut }`.

### 7.2 `BooksContext` — `useReducer` store

**State shape:**

```typescript
interface State {
  books:    Book[]
  loading:  boolean
  error:    string
  query:    string
  filters:  FiltersState
}

interface FiltersState {
  status:  BookStatus | 'all'    // default: 'all'
  type:    BookType  | 'all'     // default: 'all'
  author:  string                // substring match
}
```

**Reducer actions:**

| Action | Effect |
|---|---|
| `LOADING` | `loading = true` |
| `SET` | Replace `books[]`, `loading = false` |
| `ADD` | Append to `books[]` |
| `UPDATE` | Replace matching book by `id` |
| `DELETE` | Filter out book by `id` |
| `ERROR` | Set `error`, `loading = false` |
| `QUERY` | Update `query` string |
| `SET_FILTERS` | Merge partial `FiltersState` |
| `CLEAR_FILTERS` | Reset to defaults |

**Search logic** (применяется к `query`):

```typescript
const q = query.toLowerCase()
book.title.toLowerCase().includes(q)
|| book.author.toLowerCase().includes(q)
|| book.series_name?.toLowerCase().includes(q)
|| book.container_title?.toLowerCase().includes(q)
|| book.genres?.some(g => g.toLowerCase().includes(q))
```

Поиск по `series_name` позволяет ввести "Основание" и увидеть все книги серии.

**Filter logic:**

```typescript
status: book.status === filters.status         (пропускается если 'all')
type:   book.type   === filters.type           (пропускается если 'all')
author: book.author.toLowerCase().includes(filters.author.toLowerCase())
```

---

## 8. Component Architecture

### 8.1 Component tree

```
App
└── AuthProvider
    └── BooksProvider
        └── AppInner
            ├── [phase=loading]  → splash screen
            ├── [phase=login]    → LoginPage
            └── [phase=ready]    → MainContent
                ├── Header
                │   ├── FilterPanel (conditional)
                │   └── SettingsModal (conditional)
                ├── [view=list]  → BookGrid
                │   ├── BookList
                │   └── AddBookModal (conditional)
                └── [view=stats] → StatsPage
```

### 8.2 `App.tsx`

Идентична Films PWA. Phases: `'loading' | 'login' | 'ready'`.

### 8.3 `Header`

Props: `{ onLogoClick, onStatsClick }`

Отличия от Films PWA: лейбл "Books", иконка — книга. Всё остальное идентично.

### 8.4 `FilterPanel`

Контролы:
- **Status chips:** All / Want / Reading / Read
- **Type chips:** All / Роман / Рассказ / Повесть / Сборник / Прочее
- **Author:** `<input type="search">` — substring match

Кнопка "Сбросить фильтры" при `activeFilterCount > 0`.

### 8.5 `BookGrid`

Аналог `MovieGrid`. Состояния: loading → error → empty state → `<BookList>` + FAB `+`.  
Управляет `editing: Book | null`.

### 8.6 `BookList`

Сортировка по умолчанию: `localeCompare('ru')` по `author`, затем по `title`.  
Группировка: по первой букве автора (Кириллица → Латиница → `#`).

**Строка книги (слева направо):**
1. Обложка (`cover_url`, 60×90 px или placeholder)
2. `title` — основное название
3. `author` — автор
4. Метаданные: `year · type`
5. Серия (если есть): `series_name · #series_order` — серым мелким шрифтом, напр. "Основание · #1"
6. `container_title` (если есть): "из: {container_title}" — серым мелким шрифтом
7. Бейджи источников: **GB** и/или **FL** и/или **Wiki** — кликабельные ссылки

**Source badges:**

```
[GB]    →  gb_url      (только если задан)
[FL]    →  fl_url      (только если задан)
[Wiki]  →  wiki_url    (только если задан)
```

### 8.7 `AddBookModal`

Два этапа.

**Этап `'search'`:**

- Поле поиска: автор и/или название, debounce 400 ms, мин. 2 символа
- Параллельные запросы к GB и FL через `Promise.allSettled`
- Спиннер «Ищем в Google Books и FantLab…»
- Объединённая лента результатов (алгоритм — §12.1–12.2)
- Дубли из коллекции: бейдж `✓ Want` / `✓ Reading` / `✓ Read`
- Ссылка "Добавить без поиска"

**Этап `'form'`:**

Порядок полей:
1. Обложка + поля `title`, `author`
2. `year` (число)
3. `status` chips: Want / Reading / Read
4. `type` chips: Роман / Рассказ / Повесть / Сборник / Прочее
5. `series_name` — поле "Серия:" (необязательное, текст)
6. `series_order` — поле "Номер в серии:" (необязательное, число), рядом с `series_name`
7. `container_title` — поле "Входит в сборник:" (необязательное)
8. `genres` — read-only chips (из GB)
9. Секция "Источники": GB / FL / Wiki ссылки (read-only, заполняются из поиска и обогащения)

**Фоновое обогащение** (`selectSearchResult`):

```
1. Немедленно заполнить форму: title, author, year, cover_url, gb_url, fl_url, type
2. setPhase('form')
3. setLinksLoading(true)
4. Если есть gb_id:
   a. getBookDetails(gb_id) → genres, isbn13
   b. Если есть isbn13: lookupByIsbn(isbn13) → wiki_url
5. setLinksLoading(false)
```

Гарда от гонки: `currentGbId` ref — если пользователь выбрал другую книгу до завершения обогащения, устаревший результат отбрасывается.

### 8.8 `StatsPage`

Props: `{ onBack: () => void }`

**Измерения:**

| Key | Label | Source field | Логика группировки |
|---|---|---|---|
| `status` | Status | `status` | По значению |
| `type` | Type | `type` | По значению |
| `author` | Author | `author` | По значению, топ-15 |
| `genre` | Genre | `genres[]` | Каждый элемент отдельно |
| `decade` | Decade | `year` | `Math.floor(year/10)*10 + 's'` |
| `series` | Series | `series_name` | По значению, топ-15 |

SVG donut — идентичен Films PWA (`sectorPath`, viewBox 280×280, R=125, r=68).

### 8.9 `SettingsModal`

- **Google Books API key:** `<input type="password">`, сохраняется в `localStorage('gb_key')`
- **Spreadsheet picker:** список Google Sheets пользователя, смена активной таблицы

---

## 9. Navigation & Routing

Идентична Films PWA. Чистый React state.

```
AppInner.phase:  'loading' | 'login' | 'ready'
MainContent.view: 'list' | 'stats'
```

---

## 10. Styling System

### 10.1 CSS custom properties

Идентичны Films PWA (`--bg`, `--surface`, `--accent`, `--radius` и т.д.).  
Добавляется переменная для статуса "reading":

```css
--reading: #3b82f6;
```

### 10.2 CSS Modules

Каждый компонент — свой `.module.css`.

### 10.3 Material Symbols

Иконки через Google Fonts CDN.

---

## 11. Build & Deployment

### 11.1 Environment variables

| Variable | Purpose | Set in |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth2 client ID | Netlify environment |

Все остальные секреты (Google Books API key) — в `localStorage` пользователя.

### 11.2 Netlify

- **Trigger:** push to `main`
- **Build command:** `npm run build`
- **Publish directory:** `dist/`

### 11.3 PWA

- `public/manifest.json` — имя "Books", иконка, тема
- Service worker не реализован
- Устанавливается как приложение на телефон

---

## 12. Key Algorithms

### 12.1 Параллельный поиск по двум источникам

```typescript
async function searchBothSources(query: string): Promise<SearchResult[]> {
  const [gbResult, flResult] = await Promise.allSettled([
    googlebooks.searchBooks(query),
    fantlab.searchBooks(query),
  ])

  const gbBooks = gbResult.status === 'fulfilled' ? gbResult.value : []
  const flWorks = flResult.status === 'fulfilled' ? flResult.value.works ?? [] : []

  return mergeResults(gbBooks, flWorks)
}
```

`Promise.allSettled` гарантирует, что сбой одного источника не отменяет результаты другого.

### 12.2 Объединение и дедупликация результатов

```typescript
function mergeResults(gbResults: GBVolume[], flResults: FLWork[]): SearchResult[] {
  const merged: SearchResult[] = []
  const keyMap = new Map<string, SearchResult>()

  // FL в приоритете (точнее типизирует для фантастики)
  for (const fl of flResults) {
    const key = normalizeKey(fl.authors[0]?.name, fl.work_name)
    const entry: SearchResult = { fl, gb: null }
    merged.push(entry)
    keyMap.set(key, entry)
  }

  // GB — обогащаем существующий или добавляем новый
  for (const gb of gbResults) {
    const key = normalizeKey(gb.volumeInfo.authors?.[0], gb.volumeInfo.title)
    const existing = keyMap.get(key)
    if (existing) {
      existing.gb = gb
    } else {
      merged.push({ fl: null, gb })
    }
  }

  return merged
}

function normalizeKey(author = '', title = ''): string {
  return [author, title]
    .join('|')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\wа-яa-z|]/g, '')
    .trim()
}
```

### 12.3 Дубли из коллекции пользователя

```typescript
// BooksContext:
const gbIndex    = useMemo(() => buildIndex(books, b => b.gb_id),       [books])
const flIndex    = useMemo(() => buildIndex(books, b => b.fl_work_id),   [books])
const titleIndex = useMemo(() => buildIndex(books, b =>
  normalizeKey(b.author, b.title)), [books])

// В рендере результатов поиска:
const existing =
  (result.gb?.id       && gbIndex[result.gb.id]) ||
  (result.fl?.work_id  && flIndex[String(result.fl.work_id)]) ||
  titleIndex[normalizeKey(result.author, result.title)]

if (existing) selectDuplicate(existing)   // открыть в режиме редактирования
else          selectNew(result)
```

### 12.4 Фоновое обогащение Wikipedia

```typescript
async function enrichWithWikipedia(gbId: string, currentIdRef: React.MutableRefObject<string>) {
  const { isbn13 } = await getBookDetails(gbId)
  if (currentIdRef.current !== gbId) return   // пользователь уже выбрал другую книгу

  if (isbn13) {
    const { wiki_url } = await lookupByIsbn(isbn13)
    if (currentIdRef.current !== gbId) return
    if (wiki_url) setForm(f => ({ ...f, wiki_url }))
  }
}
```

### 12.5 Маппинг типа FantLab → BookType

```typescript
const FL_TYPE_MAP: Record<string, BookType> = {
  'Роман':             'novel',
  'Рассказ':           'story',
  'Микрорассказ':      'story',
  'Повесть':           'novella',
  'Сборник':           'collection',
  'Антология':         'collection',
  'Цикл':              'collection',
  'Авторский сборник': 'collection',
}

function mapWorkType(work_type_name: string): BookType {
  return FL_TYPE_MAP[work_type_name] ?? 'other'
}
```

### 12.6 Fallback-цепочка для обложки

```typescript
function resolveCoverUrl(result: SearchResult): string | undefined {
  if (result.fl?.image) return result.fl.image
  if (result.gb?.volumeInfo.imageLinks?.thumbnail)
    return result.gb.volumeInfo.imageLinks.thumbnail.replace('http://', 'https://')
  return undefined
}
```

---

*End of Technical Specification*
