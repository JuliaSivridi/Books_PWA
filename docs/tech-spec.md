# Books PWA — Technical Specification

> **Repository:** https://github.com/JuliaSivridi/Books_PWA  
> **Live app:** https://juliasivridi.github.io/Books_PWA/  
> **Version:** 0.1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Package / Folder Structure](#4-package--folder-structure)
5. [Data Model](#5-data-model)
6. [External Storage Schema (Google Sheets)](#6-external-storage-schema-google-sheets)
7. [Authentication & First-Launch Setup](#7-authentication--first-launch-setup)
8. [API Layer](#8-api-layer)
9. [UI Screens](#9-ui-screens)
10. [Key Components](#10-key-components)
11. [Theme & Colors](#11-theme--colors)
12. [PWA Manifest](#12-pwa-manifest)
13. [Loading & Empty States](#13-loading--empty-states)
14. [CI/CD & Build](#14-cicd--build)
15. [First-Time Setup (New Developer)](#15-first-time-setup-new-developer)
16. [Key Algorithms](#16-key-algorithms)

---

## 1. Overview

**Books PWA** is a personal book-tracking application. The user maintains a reading list across three statuses (Want / Reading / Read) and enriches each book with metadata fetched from Google Books and FantLab. All data is stored in the user's own Google Sheets file — there is no backend server.

### Key design decisions

| Decision | Rationale |
|---|---|
| Google Sheets as database | Zero infrastructure cost; data is human-readable and owned by the user |
| GIS implicit token flow with localStorage persistence | Survives page refresh without triggering a popup (browsers block cross-origin popups on load) |
| Parallel GB + FL search merged client-side | Combines English-catalogue depth (Google Books) with Russian-fantasy coverage (FantLab) |
| React Context + useReducer, no external state library | Small surface area; all state fits in one BooksContext |
| CSS Modules, no UI framework | Fine-grained control; avoids large CSS bundle |
| Vite + SWC | Fast cold starts and HMR |
| GitHub Actions → GitHub Pages | Fully serverless deployment |

---

## 2. Tech Stack

| Layer | Library | Version | Notes |
|---|---|---|---|
| UI framework | react | ^18.3.1 | Strict mode enabled in main.tsx |
| UI framework | react-dom | ^18.3.1 | |
| Bundler | vite | ^5.3.4 | base: '/Books_PWA/' |
| Compiler plugin | @vitejs/plugin-react-swc | ^3.7.0 | SWC-based JSX transform |
| Language | typescript | ^5.5.3 | target ES2020, strict |
| Auth | Google Identity Services | runtime CDN | Implicit token flow, loaded via `<script async defer>` |
| Database | Google Sheets API v4 | runtime | No SDK; direct `fetch` calls |
| File discovery | Google Drive API v3 | runtime | drive.metadata.readonly scope only |
| Book search | Google Books API v1 | runtime | No SDK; optional API key |
| Book search | FantLab API | runtime | No auth; public API |
| Wikipedia lookup | Wikidata SPARQL | runtime | ISBN-13 → Wikipedia URL |
| Icons | Material Symbols Outlined | runtime CDN | FILL=0, wght=300, GRAD=0, opsz=24 |

---

## 3. Architecture

**Pattern:** flat React Context (no MVVM, no Redux). State lives in `BooksContext`; components read and dispatch through `useBooks()`.

### Data-flow diagram

```
User action
    │
    ▼
Component (e.g. AddBookModal)
    │  calls context method
    ▼
BooksContext (create / edit / remove / setQuery / setFilters)
    │  calls service function
    ▼
sheets.ts (addBook / updateBook / deleteBook / fetchBooks)
    │  calls auth.ts for fresh token
    ▼
Google Sheets API v4  ←→  Google Drive API v3
    │
    ▼
dispatch(action) → reducer → new state
    │
    ▼
useMemo: filtered books, indexes
    │
    ▼
Component re-render
```

### Write path (create a book)

1. User fills form in `AddBookModal` and clicks "Add book".
2. `handleSave()` calls `create({ id: uuid(), ...form })` from `BooksContext`.
3. `create` calls `addBook(book)` in `sheets.ts`.
4. `sheets.ts` calls `refreshTokenIfNeeded()` → returns cached or refreshed access token.
5. `fetch POST` to `https://sheets.googleapis.com/v4/spreadsheets/{id}/values/Books!A:P:append` with `valueInputOption=RAW&insertDataOption=INSERT_ROWS`.
6. Response `updates.updatedRange` (e.g. `Books!A5:P5`) is parsed to extract the row number.
7. Book returned with `_row` set; `dispatch({ type: 'ADD', payload: saved })` appends to `state.books`.
8. Modal closes; `filtered` is recomputed by `useMemo`.

### Read path

1. `MainContent` mounts → `useEffect(() => { load() }, [load])`.
2. `load()` dispatches `LOADING`, then calls `initializeSheet()` (writes headers if sheet is blank), then `fetchBooks()`.
3. `fetchBooks` does `GET /values/Books!A:P`, slices off header row, maps each row via `rowToBook()`.
4. `dispatch({ type: 'SET', payload: books })` → `state.books` updated.
5. `useMemo` recomputes `filtered`, `gbIndex`, `flIndex`, `titleIndex`.
6. `BookGrid` renders `BookList` with `filtered`.

### Error handling

- Every `sheets.ts` function throws `Error(message)` on non-OK HTTP. The error message comes from `err.error.message` in the Sheets API response body, or falls back to `"Sheets API {status}"`.
- `BooksContext.load()` catches and dispatches `{ type: 'ERROR', payload: String(e) }`.
- `BookGrid` renders the error string in red when `error !== null`.
- `AddBookModal.handleSave()` catches and sets local `saveError` state.
- External enrichment calls (FantLab genres, Wikidata) fail silently — they don't block saving.

---

## 4. Package / Folder Structure

```
Books-PWA/
├── .github/
│   └── workflows/
│       └── deploy.yml          CI/CD: build + deploy to GitHub Pages
├── docs/
│   ├── tech-spec-example.css   CSS template for HTML spec
│   ├── tech-spec.md            This document
│   └── tech-spec.html          HTML version of this document
├── public/
│   ├── manifest.json           PWA manifest (name, icons, start_url)
│   └── icons/
│       └── icon.svg            App icon: orange rounded rect + white outlined book
├── src/
│   ├── main.tsx                React root; mounts <App /> in StrictMode
│   ├── App.tsx                 Phase machine (loading/login/ready); context providers
│   ├── App.module.css          Splash screen styles
│   ├── index.css               Global CSS variables (light+dark), resets, Material Symbols
│   ├── vite-env.d.ts           Vite type declarations (import.meta.env)
│   ├── google.d.ts             TypeScript types for window.google GIS API
│   ├── types/
│   │   └── book.ts             Book interface, BookStatus, BookType enums, label/color maps
│   ├── services/
│   │   ├── auth.ts             GIS OAuth2 token management + localStorage persistence
│   │   ├── drive.ts            Drive API: find/create db_books spreadsheet, list sheets
│   │   ├── sheets.ts           Sheets API CRUD: row↔Book mapper, initializeSheet, CRUD ops
│   │   ├── googlebooks.ts      Google Books API: search, getBookDetails, cover URL, page URL
│   │   ├── fantlab.ts          FantLab API: search-txt, work genres, type mapping
│   │   └── wikidata.ts         Wikidata SPARQL: ISBN-13 → Wikipedia URL
│   ├── context/
│   │   ├── AuthContext.tsx     React context wrapping auth.ts; exposes authenticated, user
│   │   └── BooksContext.tsx    Central state: books[], filters, query, CRUD actions, indexes
│   └── components/
│       ├── LoginPage.tsx       Full-screen sign-in with Google button
│       ├── LoginPage.module.css
│       ├── Header.tsx          Sticky top bar: logo, search, filter toggle, user menu
│       ├── Header.module.css
│       ├── FilterPanel.tsx     Expandable filter: status chips + type chips
│       ├── FilterPanel.module.css
│       ├── BookGrid.tsx        Container: loading/error/empty states, FAB, AddBookModal
│       ├── BookGrid.module.css
│       ├── BookList.tsx        Alphabetically grouped list with dividers
│       ├── BookList.module.css
│       ├── AlphaPicker.tsx     Modal letter-grid for jumping to alphabetical section
│       ├── AlphaPicker.module.css
│       ├── AddBookModal.tsx    Two-phase modal: search → form, with enrichment
│       ├── AddBookModal.module.css
│       ├── StatsPage.tsx       Full-page statistics with donut charts
│       ├── StatsPage.module.css
│       ├── SettingsModal.tsx   Settings: spreadsheet picker + GB API key
│       └── SettingsModal.module.css
```

---

## 5. Data Model

### Book

Defined in `src/types/book.ts`.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | UUID (crypto.randomUUID or timestamp+random fallback) |
| `title` | `string` | yes | Book title |
| `author` | `string` | yes | Primary author name |
| `year` | `number` | no | Publication year |
| `status` | `BookStatus` | yes | Reading status: `'want'` / `'reading'` / `'read'` |
| `type` | `BookType` | no | Work type: `'novel'` / `'story'` / `'novella'` / `'collection'` / `'other'` |
| `cover_url` | `string` | no | Cover image URL (HTTPS) |
| `gb_id` | `string` | no | Google Books volume ID |
| `gb_url` | `string` | no | Modern Google Books page URL |
| `fl_work_id` | `string` | no | FantLab work ID (stored as string) |
| `fl_url` | `string` | no | FantLab work page URL |
| `wiki_url` | `string` | no | Wikipedia article URL |
| `genres` | `string[]` | no | Genre tags (from GB categories or FL classificatory) |
| `container_title` | `string` | no | Anthology or collection this work appears in |
| `series_name` | `string` | no | Series name |
| `series_order` | `number` | no | Position in series |
| `_row` | `number` | no | **Runtime only.** 1-based Google Sheets row number. Never written to the sheet. |

### Status labels and colors

| Value | Label | Color |
|---|---|---|
| `want` | `Want` | `#f59e0b` |
| `reading` | `Reading` | `#3b82f6` |
| `read` | `Read` | `#10b981` |

### Type labels

| Value | Label (Russian) |
|---|---|
| `novel` | Роман |
| `story` | Рассказ |
| `novella` | Повесть |
| `collection` | Сборник |
| `other` | Прочее |

---

## 6. External Storage Schema (Google Sheets)

### File

- Drive file name: `db_books`  
- Drive MIME type: `application/vnd.google-apps.spreadsheet`  
- Sheet (tab) name: `Books`

### Column layout (A–P)

| Column | Index | Field | Value format |
|---|---|---|---|
| A | 0 | `id` | UUID string |
| B | 1 | `title` | Plain string |
| C | 2 | `author` | Plain string |
| D | 3 | `year` | Integer string, e.g. `"1984"` |
| E | 4 | `status` | Literal string: `"want"` / `"reading"` / `"read"` |
| F | 5 | `type` | Literal string: `"novel"` / `"story"` / `"novella"` / `"collection"` / `"other"` or empty |
| G | 6 | `cover_url` | HTTPS URL or empty |
| H | 7 | `gb_id` | Google Books volume ID or empty |
| I | 8 | `gb_url` | Full URL or empty |
| J | 9 | `fl_work_id` | FantLab numeric ID as string or empty |
| K | 10 | `fl_url` | Full URL or empty |
| L | 11 | `wiki_url` | Full URL or empty |
| M | 12 | `genres` | JSON array string, e.g. `'["Fiction","Science Fiction"]'`, or empty |
| N | 13 | `container_title` | Plain string or empty |
| O | 14 | `series_name` | Plain string or empty |
| P | 15 | `series_order` | Integer string or empty |

Row 1 is a header row with field names `id, title, author, ...` written by `initializeSheet()`. Data rows start at row 2.

### Row ↔ Book mapping

**rowToBook** (sheets.ts `rowToBook(row, rowIndex)`):
- `_row = rowIndex + 2` (rowIndex is 0-based within slice(1), so +2 skips header)
- `year = parseInt(row[3]) || undefined` — empty string → undefined
- `status = (row[4] as BookStatus) || 'want'` — defaults to `'want'` if missing
- `genres = parseArr(row[12])` — tries `JSON.parse`, returns undefined on failure
- Rows where `id` or `title` are falsy are filtered out after mapping

**bookToRow** (sheets.ts `bookToRow(b)`):
- `genres` → `JSON.stringify(b.genres)` if non-empty array, else empty string
- `year`, `series_order` → `String(value)` or empty string
- All other optional fields → value or empty string

### Initialization

`initializeSheet()` reads `Books!A1:A1`. If the cell is not `'id'`, it PUTs the full header row `['id','title','author','year','status','type','cover_url','gb_id','gb_url','fl_work_id','fl_url','wiki_url','genres','container_title','series_name','series_order']` to `Books!A1:P1`.

### Delete operation

`deleteBook()` requires two API calls:
1. GET `/{spreadsheetId}?fields=sheets.properties` to find the numeric `sheetId` of the "Books" tab.
2. POST `/{spreadsheetId}:batchUpdate` with a `deleteDimension` request (`startIndex: _row - 1`, `endIndex: _row`, dimension `ROWS`).

After deletion all subsequent `_row` values are invalidated; the app reloads from the sheet after navigation.

---

## 7. Authentication & First-Launch Setup

### localStorage keys

| Key | Content |
|---|---|
| `books_user` | JSON-serialized `UserProfile` (`{ email, name, picture }`) |
| `books_token` | Raw OAuth2 access token string |
| `books_token_expiry` | Unix timestamp (ms) when token expires |
| `books_sheet_id` | Google Sheets file ID |
| `books_sheet_name` | Google Sheets file name |
| `gb_key` | Google Books API key (optional) |
| `google_client_id` | OAuth client ID (fallback if env var not set) |

### initAuth flow (src/services/auth.ts)

```
initAuth(clientId)
  │
  ├─ Fast path: getUser() && loadPersistedToken()?
  │    └─ yes → notify(true) → DONE (no GIS call)
  │
  ├─ waitForGIS()  (polls window.google?.accounts?.oauth2 every 50ms)
  │
  ├─ getUser() exists?
  │    ├─ yes → trySilentSignIn(prompt:'', login_hint: email)
  │    │          ├─ success → notify(true)
  │    │          └─ failure → notify(false) → LoginPage
  │    └─ no  → notify(false) → LoginPage
```

### trySilentSignIn / signIn

Both use `makeTokenClient()` which calls `window.google.accounts.oauth2.initTokenClient()`.

- `trySilentSignIn`: `prompt: ''`, `login_hint: user.email` — browser may use cached session silently.
- `signIn`: `prompt: 'consent'` — always shows the consent popup.

On success the GIS callback:
1. Calls `persistToken(access_token, expires_in)` → stores token + expiry in localStorage, sets module-level variables.
2. If no user profile is stored yet, fetches `https://www.googleapis.com/oauth2/v3/userinfo` and calls `saveUser(profile)`.
3. Calls `notify(true)`.

### Token freshness

`isTokenFresh()` returns true if `accessToken !== null && Date.now() < tokenExpiresAt - 30_000`.

`refreshTokenIfNeeded()`:
1. If fresh → return cached token.
2. Try `loadPersistedToken()` — if localStorage token is still valid (> 30s remaining) → return it.
3. Try `trySilentSignIn()` → return new token or null.

### AppInner startup

```
onAuthChange listener registered
initAuth(CLIENT_ID) called
  │
  ├─ isAuth = true →
  │    findOrCreateBooksFile()
  │      ├─ success → setPhase('ready')
  │      └─ failure → setDriveError(msg); setPhase('login')
  │
  └─ isAuth = false → setPhase('login')
```

`findOrCreateBooksFile()`:
1. If `localStorage.books_sheet_id` exists → return it immediately.
2. Search Drive: `name='db_books' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`.
3. If found → `setSheetFile(id, name)`; return id.
4. If not found → POST to Sheets API to create a new spreadsheet with title `db_books` and one sheet named `Books` (sheetId: 0); store id; return id.

### Sign-out

`signOut()`:
1. Calls `window.google.accounts.oauth2.revoke(email, () => {})`.
2. Calls `clearPersistedToken()` (removes token + expiry from localStorage).
3. Calls `localStorage.removeItem('books_user')`.
4. Calls `notify(false)` → `AppInner` transitions to phase `'login'`.

### OAuth scopes

```
email
profile
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive.metadata.readonly
```

---

## 8. API Layer

### Google Sheets API v4

Base URL: `https://sheets.googleapis.com/v4/spreadsheets`

All calls go through the internal `api(path, method, body?)` function which: (1) calls `refreshTokenIfNeeded()`, (2) reads `getSheetId()` from localStorage, (3) attaches `Authorization: Bearer {token}` and `Content-Type: application/json`.

| Operation | Method | Path | Notes |
|---|---|---|---|
| Read headers | GET | `/{id}/values/Books!A1:A1` | Check cell A1 = `'id'` |
| Write headers | PUT | `/{id}/values/Books!A1:P1?valueInputOption=RAW` | First-run initialization |
| Read all books | GET | `/{id}/values/Books!A:P` | Returns all 16 columns |
| Append book | POST | `/{id}/values/Books!A:P:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS` | Response contains `updates.updatedRange` with new row |
| Update book | PUT | `/{id}/values/Books!A{row}:P{row}?valueInputOption=RAW` | Requires `_row` |
| Get sheet metadata | GET | `/{id}?fields=sheets.properties` | Required for delete (gets numeric sheetId) |
| Delete row | POST | `/{id}:batchUpdate` | `deleteDimension` request |

### Google Drive API v3

Base URL: `https://www.googleapis.com/drive/v3`

| Operation | Method | Path | Notes |
|---|---|---|---|
| Find db_books | GET | `/files?q=name='db_books'...&fields=files(id,name)` | trashed=false |
| List all sheets | GET | `/files?q=mimeType=spreadsheet...&orderBy=modifiedTime+desc` | Used in SettingsModal picker |

### Google Books API v1

Base URL: `https://www.googleapis.com/books/v1`

| Operation | Method | Path | Notes |
|---|---|---|---|
| Search | GET | `/volumes?q={query}&maxResults=8[&key={key}]` | HTTP 429 → throws `GBRateLimitError` |
| Get details | GET | `/volumes/{gbId}[?key={key}]` | Returns `industryIdentifiers` + `categories` |

- Categories from the API are split by `' / '` to produce individual genre tags.
- Page URL generated locally as `https://books.google.com/books/edition/_/{id}?gbpv=0` (the `infoLink` field in the API response points to a deprecated UI).
- API key priority: `localStorage.getItem('gb_key')` → `import.meta.env.VITE_GOOGLE_BOOKS_API_KEY` → no key (100 req/day limit).

### FantLab API

Base URL: `https://api.fantlab.ru` (no auth required)

| Operation | Method | Path | Notes |
|---|---|---|---|
| Search | GET | `/search-txt?q={query}` | Returns `{ works: FLMiniWork[] }` |
| Get genres | GET | `/work/{id}/extended` | Returns `classificatory.genre_group` |

**Type mapping** (`FL_TYPE_MAP`): keys are all-lowercase Russian (`name_type`) or English (`name_type_icon`) strings.

| Input | BookType |
|---|---|
| роман / novel | novel |
| рассказ / рассказ / story / shortstory | story |
| микрорассказ | story |
| повесть / novella | novella |
| сборник / авторский сборник / collection / anthology / cycle / цикл / антология | collection |
| anything else | other |

**Genre enrichment** (`getWorkGenres`): fetches `/work/{id}/extended`, finds the group whose label matches `/жанр/i`, then recursively collects items where `percent >= 0.1`, up to 8 results total.

**Image URL fixing** (`fixImageUrl`): protocol-relative `//cdn...` → `https://cdn...`; path-relative `/img...` → `https://fantlab.ru/img...`.

### Wikidata SPARQL

Endpoint: `https://query.wikidata.org/sparql`

SPARQL query matches `wdt:P212` (ISBN-13), requests `ruWiki` and `enWiki` optional bindings. Prefers Russian Wikipedia; falls back to English. Returns `null` if no match or on network error.

---

## 9. UI Screens

### LoginPage

**File:** `src/components/LoginPage.tsx`  
**Shown when:** `phase === 'login'` in AppInner (auth not established, or Drive error).

**Layout:**
- Centered column, max-width 360px, min-height 100dvh.
- Logo row: `icons/icon.svg` at 56×56px (border-radius 14px) + "Books" h1 (font-size 2rem, font-weight 800, color `--accent`) + tagline "Your personal book library" (0.9375rem, color `--text-2`).
- Description block: two lines in 0.9375rem `--text-2` — "Data stored in your Google Sheets." / "Access from any device, works offline."
- Error message (if `externalError` prop passed or sign-in throws): 0.9rem `--danger`, centered.
- "Sign in with Google" button: full width, accent background, 1rem 600 weight, inline SVG Google logo.

**State:** `loading: boolean`, `error: string | null`.

**Actions:**
- Button click → `handleSignIn()` → `signIn()` (GIS popup with `prompt: 'consent'`).
- On GIS success: `notify(true)` → `onAuthChange` in AppInner triggers → phase becomes `'ready'`.
- On failure: sets local error "Sign in failed. Please try again."

---

### BookGrid (main list container)

**File:** `src/components/BookGrid.tsx`  
**Shown when:** `phase === 'ready'` and `view === 'list'`.

**Props:** `alphaOpen: boolean`, `onAlphaClose: () => void`

**Data sources:** `filtered`, `loading`, `error` from `useBooks()`.

**States:**
- `loading` → centered spinner (36×36px, `--border` + `--accent` top, 0.7s spin).
- `error` → centered error text in `--danger`.
- `filtered.length === 0` → empty state (see §13).
- `filtered.length > 0` → `<BookList>`.

**Modals (local state):**
- `editing: Book | null` — when set, opens `AddBookModal` in edit mode.
- `showAdd: boolean` — when true, opens `AddBookModal` in add mode.

**FAB:** fixed bottom-right (24px inset), 52×52px circle, `--accent`, shadow `0 4px 16px rgba(224,126,56,.4)`, `add` icon at 26px.

---

### BookList

**File:** `src/components/BookList.tsx`  
**Props:** `books: Book[]`, `onEdit: (b: Book) => void`, `alphaOpen: boolean`, `onAlphaClose: () => void`

**Sorting:** `books.sort((a, b) => a.title.localeCompare(b.title, 'ru') || a.author.localeCompare(b.author, 'ru'))`

**Grouping:** first character of `title` uppercased:
- Cyrillic А–Я (including Ё) → their letter.
- Latin A–Z → their letter.
- Anything else → `'#'`.

Letter order: Cyrillic first (index in `'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'`), then Latin (`100 + charCodeAt(0)`), then `#` (999).

**Dividers:** `<div id="alpha-{letter}" className={styles.divider}>` — provides scroll targets. `scroll-margin-top: 64px` compensates for sticky header.

**Row layout (per book):**
- Cover wrap (flex-shrink: 0, position relative):
  - `<img>` at 90×135px with `object-fit: cover` if `cover_url` exists.
  - Placeholder `<div>` 90×135px with `menu_book` icon (22px) otherwise.
  - Status dot: 16×16px circle, `background: STATUS_COLORS[status]`, `border: 2px solid var(--surface)`, positioned `bottom: 5px right: 5px`.
- Info column (flex: 1, overflow hidden):
  - Title: 1rem, font-weight 600, `-webkit-line-clamp: 2`.
  - Author: 1rem, `--text-2`, single line with ellipsis.
  - Meta (`year · type`): 1rem, `--text-3`, only rendered if `b.year || b.type`.
  - Series: 1rem, `--text-3`, only rendered if `b.series_name`.
  - Container title: 1rem, `--text-3`, italic, only rendered if `b.container_title`.
  - Links row (GB/FL/Wiki): only rendered if at least one URL is present; click stops propagation.

**AlphaPicker:** rendered inside the list container when `alphaOpen === true`.

---

### AlphaPicker

**File:** `src/components/AlphaPicker.tsx`  
**Props:** `letters: string[]`, `onSelect: (letter: string) => void`, `onClose: () => void`

Fixed overlay (background `rgba(0,0,0,.55)`, backdrop-filter blur 2px, z-index 50). Inner card: max-width 360px, border-radius 16px, padding 16px.

Grid: `grid-template-columns: repeat(7, 1fr)`, gap 5px. Each letter button: height 46px, border-radius 8px, font-size 1.05rem, font-weight 700, color `--accent`.

Click on overlay background (not button) → `onClose()`.  
Click on letter button → `onSelect(letter)` → `scrollToLetter(letter)` is called in `BookList` which calls `document.getElementById('alpha-{letter}').scrollIntoView({ behavior: 'smooth', block: 'start' })`, then `onAlphaClose()`.

---

### AddBookModal

**File:** `src/components/AddBookModal.tsx`  
**Props:** `book?: Book` (edit mode), `onClose: () => void`

**Phases:** `'search'` (default for new) / `'form'` (default for edit).

**Search phase:**
- Input with `autoFocus`, placeholder "Title or author…".
- Debounce: 400ms (via `useRef<ReturnType<typeof setTimeout>>`).
- Parallel search: `Promise.allSettled([gbSearch(query), flSearch(query)])` — minimum query length: 2 characters.
- Results merged by `mergeResults()` — see §16.
- Each result shows: thumbnail (36×54px), title, author + year, GB/FL source badges.
- Duplicate detection via `findDuplicate()` — checks `gbIndex`, `flIndex`, `titleIndex` in that order. If duplicate found, shows colored status badge; clicking opens the existing book for editing.
- "Add without search" link skips to form phase.

**Form phase:**
- Cover preview: 60×90px.
- Title, Author inputs.
- Year input (type number, min 1, max 2099).
- Status chips: Want (amber), Reading (blue), Read (green) — always one selected.
- Type chips: Роман/Рассказ/Повесть/Сборник/Прочее — clicking active type deselects it.
- Series name + series order (80px wide number input) in one row.
- Container title input.
- Sources section: three rows (Google Books / FantLab / Wikipedia), each with a label (88px wide), editable URL input, and `open_in_new` icon link.
- Genres section: read-only tag chips (`font-size .775rem`), only rendered when `form.genres?.length > 0`.

**Background enrichment** (fires on `selectResult()`):
1. FL genres fetch (`getWorkGenres(fl_work_id)`) — sets `form.genres` only if genres not already present. Stale-check via `currentGbRef`.
2. GB details fetch (`getBookDetails(gb_id)`) — if `categories` returned, **overrides** FL genres. Then if `isbn13` returned, calls `lookupByIsbn(isbn13)` for Wikipedia URL.

**Save:**
- Validation: title or author must be non-empty.
- Edit mode: `edit({ ...editTarget, ...form })`.
- Add mode: `create({ id: uuid(), ...form })`.

---

### StatsPage

**File:** `src/components/StatsPage.tsx`  
**Shown when:** `view === 'stats'`.  
**Props:** `onBack: () => void`

**Dimensions (selector chips):**

| Key | Label | Multi-value? |
|---|---|---|
| `status` | Status | no |
| `type` | Type | no |
| `author` | Author | no |
| `genre` | Genre | **yes** (array) |
| `decade` | Decade | no |
| `series` | Series | no |

**computeSlices logic:**
- For each book, collects `keys[]` for the selected dimension.
- `uniqueCount` increments by 1 per book that has at least one non-empty key (regardless of how many keys).
- Each key increments `counts[key]`.
- Results sorted descending by count; top 15 shown; remainder summed as "Others" (color `#94a3b8`).

**DonutChart:**
- SVG `viewBox="0 0 280 280"` (240×240 on screens < 520px).
- `cx=140 cy=140 R=125 r=68` (outer radius 125, inner radius 68).
- Center text: `uniqueCount` (font-size 2rem, font-weight 700), "books" label (0.8rem, `--text-3`).
- Each sector rendered as an SVG `<path>` with `stroke="var(--surface)" strokeWidth="2.5"` gap.

**Color palette** (15 entries, cycling):
`#6366f1 #f59e0b #10b981 #f43f5e #3b82f6 #8b5cf6 #22d3ee #84cc16 #f97316 #ec4899 #14b8a6 #a78bfa #fb923c #4ade80 #e11d48`

**Legend:** right of chart (flex: 1, min-width 200px). Each row: 12×12px rounded square (border-radius 3px), label (0.9rem), count (0.9rem, font-weight 600, min-width 36px, right-aligned).

---

### SettingsModal

**File:** `src/components/SettingsModal.tsx`  
**Props:** `onClose: () => void`

Max-width 440px, border-radius 16px.

**Section 1 — Google Spreadsheet:**
- Shows current sheet name and a "Change" button.
- On "Change": `listUserSheets()` (Drive API) returns all Google Sheets ordered by `modifiedTime desc`.
- Picker list (max-height 240px): clicking any item calls `setSheetFile(id, name)` then `load()` to reload books.
- Currently active sheet shown with accent color + checkmark icon (18px).

**Section 2 — Google Books API Key:**
- `<input type="password">` bound to `gbKey` state, initialized from `getGBKey()`.
- Hint: "Optional. Without a key, Books API is limited to 100 requests/day."

**Save:** writes `gbKey.trim()` to `localStorage.gb_key`, shows "✓ Saved", closes after 700ms.

**Overlay click-outside:** closes modal (checked via `e.target === overlayRef.current`).

---

## 10. Key Components

### Header

**File:** `src/components/Header.tsx`  
**Props:** `onLogoClick: () => void`, `onStatsClick: () => void`

Sticky, `top: 0`, `z-index: 10`, `backdrop-filter: blur(12px)`, background `rgba(var(--bg-rgb), .88)`.

| Element | Details |
|---|---|
| Logo button | `icons/icon.svg` 26×26px + "Books" text (hidden on ≤520px via media query) |
| Search input | `padding-left: 36px`, height 36px, font-size .875rem, search icon at left |
| Filter button | 36×36px, `tune` icon; accent-highlighted when `filterOpen` or `activeFilterCount > 0`; badge (15×15px, font-size 0.6rem) shows active filter count |
| Avatar button | 36×36px circle; shows `user.picture` or first letter of `user.name` on accent background |
| User menu | Dropdown card, min-width 210px, border-radius 12px, `animation: menuIn .12s ease`; items: Statistics, Settings, Sign out (red) |

`FilterPanel` renders inline below the top bar when `filterOpen === true`.

---

### FilterPanel

**File:** `src/components/FilterPanel.tsx`  
(No props — reads/writes `BooksContext` directly)

Two rows: Status and Type. Each row has a label (width 68px, font-size .875rem, uppercase) and a chip group.

**Status chips:** All / Want / Reading / Read  
Active chip for Want/Reading/Read uses the same amber/blue/green color scheme as the status dots (`data-status` attribute drives CSS).

**Type chips:** All / Роман / Рассказ / Повесть / Сборник / Прочее  
Active type chip uses `--accent` color scheme.

"Clear all filters" button (underline style, hover → `--danger`) shown when `activeFilterCount > 0`.

---

### AlphaPicker

See §9 — AlphaPicker subsection (fully described there).

---

## 11. Theme & Colors

All variables defined in `src/index.css`.

| Constant | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | `#F5F3F0` | `#0f0f0f` | Page background |
| `--bg-rgb` | `245, 243, 240` | `15, 15, 15` | Header backdrop-filter rgba |
| `--surface` | `#FFFFFF` | `#1a1a1a` | Card / modal background |
| `--surface-2` | `#F0EDE8` | `#242424` | Input background, row hover |
| `--surface-3` | `#E5E1DA` | `#2e2e2e` | Row active, search result hover |
| `--border` | `#DDD9D2` | `#333333` | All borders, dividers |
| `--text` | `#1C1C1C` | `#f0f0f0` | Primary text |
| `--text-2` | `#6B6B6B` | `#999999` | Secondary text |
| `--text-3` | `#A0A0A0` | `#555555` | Placeholder, meta text |
| `--accent` | `#E07E38` | `#E8935A` | Primary brand color |
| `--accent-hover` | `#C96E2F` | `#D4814A` | Button hover state |
| `--accent-light` | `rgba(224,126,56,.14)` | `rgba(232,147,90,.15)` | Active chip backgrounds |
| `--want` | `#f59e0b` | — | Want status |
| `--reading` | `#3b82f6` | — | Reading status |
| `--read` | `#10b981` | — | Read status |
| `--danger` | `#ef4444` | — | Error text, sign-out |
| `--radius` | `12px` | — | Modal/button border-radius |
| `--radius-sm` | `8px` | — | Input/small element radius |
| `--shadow` | `0 4px 20px rgba(0,0,0,.08)` | `0 4px 24px rgba(0,0,0,.55)` | Modal shadow |

Dark theme activated via `@media (prefers-color-scheme: dark)`.

---

## 12. PWA Manifest

File: `public/manifest.json`

| Field | Value |
|---|---|
| `name` | `"Books"` |
| `short_name` | `"Books"` |
| `description` | `"Personal book collection manager"` |
| `theme_color` | `#E07E38` |
| `background_color` | `#E07E38` |
| `display` | `standalone` |
| `start_url` | `/Books_PWA/` |
| `scope` | `/Books_PWA/` |
| `icons[0].src` | `icons/icon.svg` (relative path) |
| `icons[0].sizes` | `any` |
| `icons[0].type` | `image/svg+xml` |
| `icons[0].purpose` | `any maskable` |

**Icon design** (`public/icons/icon.svg`, `viewBox="0 0 100 100"`):
- Orange rounded rect background (`rx="22"`, fill `#E07E38`).
- Spine: solid white rect (`x=19 y=16 w=9 h=68 rx=3.5`).
- Cover: stroke-only rect (`x=24 y=16 w=57 h=68 rx=5`, `fill="none" stroke="white" strokeWidth=4.5`) — orange interior shows through.
- Three text lines: solid white (full opacity, 85%, 85%, 70%).

---

## 13. Loading & Empty States

### Splash screen (App.tsx)

Shown during phase `'loading'`. Centered column on `--bg` background: `icons/icon.svg` at 64×64px, then a 32×32px spinner (border 3px, `--border` + `--accent` top, 0.7s linear spin).

### Book list loading (BookGrid)

Centered 36×36px spinner (border 3px, `--border` + `--accent` top, 0.7s linear spin). Minimum height 300px.

### Empty book list (BookGrid)

Icon: `menu_book` at 48px, color `--border`.  
Text: "No books found" in `--text-2`.  
Button: "Add your first book" (accent background, 12px radius, font-weight 600), opens AddBookModal.

### Search no results (AddBookModal)

Text: "Nothing found" (0.85rem, `--text-3`, centered). Shown when `query.length >= 2 && !searching && results.length === 0`.

### Stats no data

Text: "No data for this dimension" (0.9rem, `--text-3`, centered, padding 40px 0).

### Sheet picker empty (SettingsModal)

Text: "No Google Sheets found" in `--text-2`.

---

## 14. CI/CD & Build

**Workflow file:** `.github/workflows/deploy.yml`

**Triggers:**
- Push to branch `main`
- Manual: `workflow_dispatch`

**Concurrency:** group `pages`, `cancel-in-progress: true` (a new push cancels the in-flight deploy).

**Steps:**

| Step | Action | Details |
|---|---|---|
| Checkout | `actions/checkout@v4` | |
| Node.js | `actions/setup-node@v4` | Node 20, npm cache |
| Install | `npm ci` | |
| Build | `npm run build` (`tsc && vite build`) | Secrets: `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_BOOKS_API_KEY` |
| Configure pages | `actions/configure-pages@v4` | |
| Upload artifact | `actions/upload-pages-artifact@v3` | path: `dist/` |
| Deploy | `actions/deploy-pages@v4` | Outputs `page_url` |

**Permissions:** `contents: read`, `pages: write`, `id-token: write`.

**Build output:** `dist/` — Vite bundles all assets. `dist/` is in `.gitignore`; it is never committed to the repository.

**Vite config:** `base: '/Books_PWA/'` — all asset paths and `import.meta.env.BASE_URL` are prefixed with `/Books_PWA/`.

---

## 15. First-Time Setup (New Developer)

1. **Clone:**
   ```
   git clone https://github.com/JuliaSivridi/Books_PWA.git
   cd Books_PWA
   npm install
   ```

2. **Google Cloud Console — OAuth client:**
   - Create project → APIs & Services → OAuth consent screen (External, scopes: email, profile, spreadsheets, drive.metadata.readonly).
   - Credentials → Create OAuth 2.0 Client ID (Web application).
   - Authorized JavaScript origins: `http://localhost:5173` (dev), `https://juliasivridi.github.io` (prod).
   - Authorized redirect URIs: not required (implicit token flow — no redirect).

3. **Google Cloud Console — APIs:**
   - Enable: Google Sheets API, Google Drive API v3.
   - Optionally enable Google Books API and create an API key.

4. **Local env file** — create `.env.local` (not committed):
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_GOOGLE_BOOKS_API_KEY=your-books-api-key
   ```

5. **Run locally:**
   ```
   npm run dev
   ```
   Opens at `http://localhost:5173/Books_PWA/`.

6. **GitHub Secrets** (for CI/CD deploy):
   - Repository Settings → Secrets and variables → Actions → New repository secret.
   - Add `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_BOOKS_API_KEY`.
   - GitHub Pages source must be set to "GitHub Actions" (not a branch).

7. **Deploy:**
   Push to `main` — GitHub Actions builds and deploys automatically.

---

## 16. Key Algorithms

### mergeResults — combining Google Books + FantLab search results

```
function mergeResults(gbResults, flWorks):
  merged = []
  keyMap = Map<string, SearchResult>

  for fl in flWorks:
    key = normalizeKey(fl.authors[0].name, fl.work_name)
    entry = { fl, gb: null }
    merged.push(entry)
    keyMap.set(key, entry)

  for gb in gbResults:
    key = normalizeKey(gb.volumeInfo.authors[0], gb.volumeInfo.title)
    if keyMap.has(key):
      keyMap.get(key).gb = gb   // enrich existing FL entry with GB data
    else:
      merged.push({ fl: null, gb })   // GB-only result

  return merged
  // Result: FL-first order, with GB data merged in where title+author match
```

### normalizeKey — fuzzy match key for deduplication

```
function normalizeKey(author, title):
  key = author + '|' + title
  key = key.toLowerCase()
  key = key.replace('ё', 'е')           // Cyrillic ё/е equivalence
  key = key.replace(/[^\wа-яa-z|]/g, '') // strip punctuation/spaces
  return key.trim()
```

### computeSlices — statistics with unique-book counting

```
function computeSlices(books, dim):
  counts = {}
  uniqueCount = 0

  for book in books:
    keys = getKeysForDim(book, dim)
      // status → [STATUS_LABELS[book.status]]
      // type   → book.type ? [TYPE_LABELS[book.type]] : []
      // author → book.author ? [book.author] : []
      // genre  → book.genres ?? []
      // decade → book.year ? [floor(year/10)*10 + 's'] : []
      // series → book.series_name ? [book.series_name] : []

    validKeys = keys.filter(k => !!k)
    if validKeys.length > 0: uniqueCount++
    for k in validKeys: counts[k]++

  sorted = sortDesc(entries(counts))
  top15  = sorted.slice(0, 15)
  rest   = sum(sorted.slice(15))

  slices = top15.map((label, count, i) => ({ label, count, color: PALETTE[i] }))
  if rest > 0: slices.push({ label: 'Others', count: rest, color: '#94a3b8' })

  return { slices, uniqueCount }
  // uniqueCount = books with ≥1 value, used as center total
  // slices.count may sum > uniqueCount for multi-value dims (genre)
```

### DonutChart sector path generation

```
function sectorPath(cx, cy, R, r, a1, a2):
  // Annular sector from angle a1 to a2
  // R = outer radius (125), r = inner radius (68)
  // Angles in radians, measured from -π/2 (12 o'clock)
  large = a2 - a1 > π ? 1 : 0
  return:
    M {cx+R·cos(a1)} {cy+R·sin(a1)}
    A R R 0 {large} 1 {cx+R·cos(a2)} {cy+R·sin(a2)}
    L {cx+r·cos(a2)} {cy+r·sin(a2)}
    A r r 0 {large} 0 {cx+r·cos(a1)} {cy+r·sin(a1)}
    Z
```

### Genre enrichment stale-request guard

```
// currentGbRef holds the gb_id of the most recently selected result
// Both async enrichment chains read this ref before committing

selectResult(result):
  currentGbRef.current = result.gb?.id ?? null

  // FL genres (background, no await):
  getWorkGenres(fl_work_id).then(genres =>
    if currentGbRef.current !== snapshotGbId: return  // user selected different book
    if genres.length && !form.genres?.length: setForm(genres)
  )

  // GB details (foreground):
  { isbn13, categories } = await getBookDetails(gb_id)
  if currentGbRef.current !== gb_id: return  // stale
  if categories.length: setForm(genres = categories)  // GB overrides FL

  wiki_url = await lookupByIsbn(isbn13)
  if currentGbRef.current !== gb_id: return  // stale
  setForm(wiki_url)
```
