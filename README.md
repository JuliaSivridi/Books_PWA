# Books

[![Live PWA](https://img.shields.io/badge/Books_PWA-Live_PWA-E07E38?style=for-the-badge)](https://juliasivridi.github.io/Books_PWA/)

![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite_5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets_API-34A853?style=for-the-badge&logo=googlesheets&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google_OAuth_2.0-4285F4?style=for-the-badge&logo=google&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-222222?style=for-the-badge&logo=githubpages&logoColor=white)](https://juliasivridi.github.io/Books_PWA/)

A personal book library tracker built as a **Progressive Web App**. Runs in any browser and installs on Android/iOS/desktop as a standalone app. No backend — Google Sheets is the database.

**Live:** [juliasivridi.github.io/Books_PWA](https://juliasivridi.github.io/Books_PWA/)

---

## Features

- **Smart Add** — type a title, pick from parallel Google Books + FantLab results, and all fields auto-fill: author, year, type, cover, genres, and source links
- **Auto-enriched links** — Wikipedia article fetched automatically via Wikidata SPARQL (ISBN-13 → P212); Google Books and FantLab links populated from search results
- **Duplicate detection** — books already in your library show a ✓ Want / ✓ Reading / ✓ Read badge directly in search results; tapping one opens the edit form instead of adding a duplicate
- **Alphabetical navigation** — sorted list with letter dividers; tap the logo to open an alphabet popup and jump to any letter instantly
- **Filter panel** — filter by reading status (Want / Reading / Read) and book type (Роман / Рассказ / Повесть / Сборник); search bar covers title, author, series, and genre simultaneously
- **Statistics** — donut charts across six dimensions: status, type, author, genre, decade, series
- **Light / dark theme** — follows OS preference automatically
- **PWA** — installable on Android, iOS, and desktop; works as a standalone app with its own icon

---

## Tech Stack

| Layer | Technology |
|---|---|
| ⚛️ Framework | React 18 + TypeScript 5 |
| ⚡ Build | Vite 5 + SWC |
| 🎨 Styling | CSS Modules + CSS custom properties (light / dark theme) |
| 🗄️ Database | Google Sheets API v4 |
| 🔐 Auth | Google Identity Services (OAuth 2.0) |
| 📚 Book data | Google Books API v1 + FantLab API |
| 🔍 Wikipedia lookup | Wikidata SPARQL — ISBN-13 (P212) + Wikipedia sitelinks |
| 🚀 Hosting | GitHub Pages (deployed via GitHub Actions) |

---

## Setup

### Prerequisites

- Google account
- Google Cloud project with **Google Sheets API v4** and **Google Drive API** enabled
- OAuth 2.0 Client ID (type: Web application)
- Node.js ≥ 18

### Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Google Sheets API v4** and **Google Drive API**
3. Optionally enable **Google Books API** and create an **API key**
4. Create an **OAuth 2.0 Client ID** → type: Web application
5. Add to **Authorized JavaScript origins** (not Redirect URIs):
   ```
   http://localhost:5173
   https://your-username.github.io
   ```
6. Add your Google account as a **test user** in the OAuth consent screen

### Local Development

```bash
git clone https://github.com/JuliaSivridi/Books_PWA.git
cd Books_PWA
npm install
```

Create `.env.local` in the project root:
```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_BOOKS_API_KEY=your-books-api-key
```

```bash
npm run dev    # http://localhost:5173/Books_PWA/
npm run build  # production build → dist/
```

The Google Books API key can also be entered inside the app (Settings → Google Books API Key) and is stored in `localStorage`. The environment variable takes precedence — it is baked into the build and survives `localStorage` clears.

### Deploy to GitHub Pages

1. Add repository secrets in **Settings → Secrets and variables → Actions**:
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_GOOGLE_BOOKS_API_KEY`
2. Set **Pages source** to **GitHub Actions** (Settings → Pages)
3. Every push to `main` triggers automatic build and deployment

---

## Data Model

All data lives in the user's **db_books** Google Spreadsheet, found or created automatically on first login. A single sheet (tab name: Books) stores one book per row.

| Col | Field | Description |
|-----|-------|-------------|
| A | id | UUID |
| B | title | Book title |
| C | author | Primary author |
| D | year | Publication year |
| E | status | `want` / `reading` / `read` |
| F | type | `novel` / `story` / `novella` / `collection` / `other` |
| G | cover_url | Cover image URL |
| H | gb_id | Google Books volume ID |
| I | gb_url | Google Books page URL |
| J | fl_work_id | FantLab work ID |
| K | fl_url | FantLab work page URL |
| L | wiki_url | Wikipedia article (Russian preferred, English fallback) |
| M | genres | JSON array — e.g. `["Fiction","Science Fiction"]` |
| N | series_name | Series name |
| O | series_order | Position in series |

---

## Install as Mobile / Desktop App

**Android:** Chrome prompts automatically, or use the browser menu → *Install app*

**iOS:** Safari → Share button → *Add to Home Screen*

**Desktop:** address bar → install icon (Chrome / Edge)
