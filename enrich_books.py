#!/usr/bin/env python3
"""
enrich_books.py — Enriches a books.csv (title, author) with data from
FantLab, Google Books, and Wikidata, producing a CSV ready to import
into your Books PWA Google Spreadsheet.

Output columns match the data model (A–P):
  id, title, author, year, status, type, cover_url,
  gb_id, gb_url, fl_work_id, fl_url, wiki_url,
  genres, container_title, series_name, series_order

Usage:
  python enrich_books.py --gb-key YOUR_GOOGLE_BOOKS_API_KEY
  python enrich_books.py --gb-key KEY --input my_list.csv --output enriched.csv
  python enrich_books.py --gb-key KEY --skip-wikidata   # faster, skip Wikidata
  python enrich_books.py --gb-key KEY --skip-fl-ext     # skip FantLab genres/series call
  python enrich_books.py --gb-key KEY --delay 0.6       # slower, safer for rate limits

The script saves every row immediately and resumes if interrupted — just
re-run with the same --output path to continue from where it stopped.

Requirements: Python 3.10+ (no third-party packages needed).
"""

import sys
# Windows cmd/PowerShell default to cp1252 which can't encode Cyrillic.
# Force UTF-8 output so progress lines print correctly.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import csv
import json
import time
import uuid
import argparse
import os
import urllib.parse
import urllib.request
from typing import Optional

# ── Column order (must match Google Sheets A–P) ───────────────────────────────
COLUMNS = [
    "id", "title", "author", "year", "status", "type", "cover_url",
    "gb_id", "gb_url", "fl_work_id", "fl_url", "wiki_url",
    "genres", "container_title", "series_name", "series_order",
]

# ── API base URLs ──────────────────────────────────────────────────────────────
FL_BASE    = "https://api.fantlab.ru"
GB_BASE    = "https://www.googleapis.com/books/v1"
WD_SPARQL  = "https://query.wikidata.org/sparql"

# ── Type mapping (mirrors src/services/fantlab.ts) ────────────────────────────
FL_TYPE_MAP: dict[str, str] = {
    "роман":             "novel",
    "рассказ":           "story",
    "микрорассказ":      "story",
    "повесть":           "novella",
    "сборник":           "collection",
    "антология":         "collection",
    "цикл":              "collection",
    "авторский сборник": "collection",
    "novel":             "novel",
    "story":             "story",
    "shortstory":        "story",
    "novella":           "novella",
    "cycle":             "collection",
    "anthology":         "collection",
    "collection":        "collection",
}


# ── HTTP helper ───────────────────────────────────────────────────────────────

def http_get(url: str, accept: str = "application/json", timeout: int = 15) -> Optional[dict]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "books-enricher/1.0", "Accept": accept},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


# ── FantLab ───────────────────────────────────────────────────────────────────

def _fix_fl_image(url: Optional[str]) -> str:
    if not url:
        return ""
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return "https://fantlab.ru" + url
    return url


def search_fantlab(title: str, author: str) -> dict:
    """
    Search FantLab /search-txt and return a partial row dict with keys:
      fl_work_id, fl_url, year, type, cover_url  (all strings, may be empty)
    """
    for query in [f"{title} {author}", title]:
        q = urllib.parse.quote(query)
        data = http_get(f"{FL_BASE}/search-txt?q={q}")
        works = (data or {}).get("works") or []
        if works:
            break
    else:
        return {}

    w = works[0]
    work_id = w.get("id")
    if not work_id:
        return {}

    type_key = (w.get("name_type") or w.get("name_type_icon") or "").lower()
    image    = _fix_fl_image(w.get("image_preview") or w.get("image"))

    result: dict = {
        "fl_work_id": str(work_id),
        "fl_url":     f"https://fantlab.ru/work{work_id}",
        "type":       FL_TYPE_MAP.get(type_key, ""),
    }
    if w.get("year"):
        result["year"] = str(w["year"])
    if image:
        result["cover_url"] = image
    return result


def get_fantlab_extended(work_id: str) -> dict:
    """
    Fetch /work/{id}/extended → genres list + series info.
    Returns dict with optional keys: genres (JSON str), series_name, series_order.
    """
    data = http_get(f"{FL_BASE}/work/{work_id}/extended")
    if not data:
        return {}

    result: dict = {}

    # ── Genres ────────────────────────────────────────────────────────────────
    groups = (data.get("classificatory") or {}).get("genre_group") or []
    genre_group = next(
        (g for g in groups if "жанр" in (g.get("label") or "").lower()), None
    )
    if genre_group:
        genres: list[str] = []

        def collect(items: list) -> None:
            for item in items:
                if (item.get("percent") or 0) >= 0.1:
                    genres.append(item["label"])
                    collect(item.get("genre") or [])

        collect(genre_group.get("genre") or [])
        if genres:
            result["genres"] = json.dumps(genres[:8], ensure_ascii=False)

    # ── Series / cycle ────────────────────────────────────────────────────────
    # Field names vary — FantLab API uses cycle_id / cycle_name in some responses
    cycle_id   = data.get("cycle_id")
    cycle_name = data.get("cycle_name") or data.get("cycle") or ""
    position   = data.get("position_in_cycle") or data.get("positions_in_cycle")

    if cycle_id and cycle_name:
        result["series_name"] = str(cycle_name).strip()
    if position:
        try:
            result["series_order"] = str(int(position))
        except (ValueError, TypeError):
            pass

    return result


# ── Google Books ──────────────────────────────────────────────────────────────

def search_google_books(title: str, author: str, api_key: str) -> dict:
    """
    Search Google Books and return a partial row dict with keys:
      gb_id, gb_url, cover_url, year, _genres_gb (internal), _isbn13 (internal)
    """
    q = urllib.parse.quote(f"intitle:{title} inauthor:{author}")
    url = f"{GB_BASE}/volumes?q={q}&maxResults=3"
    if api_key:
        url += f"&key={api_key}"

    data = http_get(url)
    items = (data or {}).get("items") or []
    if not items:
        return {}

    item = items[0]
    info = item.get("volumeInfo") or {}
    gb_id = item.get("id", "")

    result: dict = {
        "gb_id":  gb_id,
        "gb_url": f"https://books.google.com/books/edition/_/{gb_id}?gbpv=0" if gb_id else "",
    }

    if info.get("publishedDate"):
        result["year"] = info["publishedDate"][:4]

    img_links = info.get("imageLinks") or {}
    img = img_links.get("thumbnail") or img_links.get("smallThumbnail")
    if img:
        result["cover_url"] = img.replace("http://", "https://")

    cats = info.get("categories") or []
    if cats:
        flat = list({s.strip() for c in cats for s in c.split(" / ") if s.strip()})
        result["_genres_gb"] = json.dumps(flat, ensure_ascii=False)

    for ident in (info.get("industryIdentifiers") or []):
        if ident.get("type") == "ISBN_13":
            result["_isbn13"] = ident["identifier"]
            break

    return result


# ── Wikidata SPARQL ───────────────────────────────────────────────────────────

def lookup_wikidata_by_isbn(isbn13: str) -> str:
    """Return Wikipedia URL (ru preferred, en fallback) or empty string."""
    query = f"""
SELECT ?ruWiki ?enWiki WHERE {{
  ?item wdt:P212 "{isbn13}" .
  OPTIONAL {{ ?ruWiki schema:about ?item; schema:isPartOf <https://ru.wikipedia.org/> }}
  OPTIONAL {{ ?enWiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }}
}} LIMIT 1"""

    url = f"{WD_SPARQL}?query={urllib.parse.quote(query)}&format=json"
    data = http_get(url, accept="application/sparql-results+json")
    bindings = ((data or {}).get("results") or {}).get("bindings") or []
    if not bindings:
        return ""
    b = bindings[0]
    return (b.get("ruWiki") or {}).get("value") or (b.get("enWiki") or {}).get("value") or ""


# ── Checkpoint ────────────────────────────────────────────────────────────────

def load_done_titles(output_path: str) -> set[str]:
    """Return lowercase titles already present in the output file."""
    done: set[str] = set()
    if os.path.exists(output_path):
        with open(output_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                done.add((row.get("title") or "").strip().lower())
    return done


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Enrich books.csv with FantLab / Google Books / Wikidata",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--input",          default="books.csv",
                        help="Input CSV with at least 'title' and 'author' columns")
    parser.add_argument("--output",         default="books_enriched.csv",
                        help="Output CSV (appended to on resume)")
    parser.add_argument("--gb-key",         default="",
                        help="Google Books API key (recommended for 500+ books)")
    parser.add_argument("--status",         default="read",
                        choices=["read", "want", "reading"],
                        help="Status to set for all books (default: read)")
    parser.add_argument("--delay",          default=0.4, type=float,
                        help="Seconds between API calls (default: 0.4)")
    parser.add_argument("--skip-wikidata",  action="store_true",
                        help="Skip Wikidata lookup — much faster but no wiki_url")
    parser.add_argument("--skip-fl-ext",   action="store_true",
                        help="Skip FantLab extended call — no genres/series from FL")
    args = parser.parse_args()

    # ── Load input ────────────────────────────────────────────────────────────
    with open(args.input, newline="", encoding="utf-8") as f:
        books = list(csv.DictReader(f))

    done     = load_done_titles(args.output)
    is_new   = not os.path.exists(args.output)
    remaining = len(books) - len(done)
    print(f"[*] {len(books)} books total  |  {len(done)} done  |  {remaining} to process")
    if not args.gb_key:
        print("[!] No --gb-key supplied -- Google Books quota may run out quickly")
    print()

    with open(args.output, "a", newline="", encoding="utf-8") as out_f:
        writer = csv.DictWriter(out_f, fieldnames=COLUMNS)
        if is_new:
            writer.writeheader()

        for i, book in enumerate(books, 1):
            title  = (book.get("title")  or "").strip()
            author = (book.get("author") or "").strip()
            if not title:
                continue
            if title.lower() in done:
                continue

            # Progress label
            label = f"{title[:42]:<42}"
            sys.stdout.write(f"[{i:3}/{len(books)}] {label} ")
            sys.stdout.flush()

            row = {c: "" for c in COLUMNS}
            row["id"]     = str(uuid.uuid4())
            row["title"]  = title
            row["author"] = author
            row["status"] = args.status
            row["genres"] = "[]"

            tags: list[str] = []  # for end-of-line status display

            # ── FantLab ───────────────────────────────────────────────────
            fl = search_fantlab(title, author)
            time.sleep(args.delay)

            if fl.get("fl_work_id"):
                for k in ("fl_work_id", "fl_url", "year", "type", "cover_url"):
                    if fl.get(k):
                        row[k] = fl[k]
                tags.append("FL")

                if not args.skip_fl_ext:
                    ext = get_fantlab_extended(fl["fl_work_id"])
                    time.sleep(args.delay)
                    if ext.get("genres"):
                        row["genres"] = ext["genres"]
                        tags[-1] += "+G"
                    for k in ("series_name", "series_order"):
                        if ext.get(k):
                            row[k] = ext[k]
                            if "+S" not in tags[-1]:
                                tags[-1] += "+S"

            # ── Google Books ──────────────────────────────────────────────
            gb = search_google_books(title, author, args.gb_key)
            time.sleep(args.delay)

            if gb.get("gb_id"):
                row["gb_id"]  = gb["gb_id"]
                row["gb_url"] = gb["gb_url"]
                tags.append("GB")
            if gb.get("cover_url") and not row["cover_url"]:
                row["cover_url"] = gb["cover_url"]
            if gb.get("year") and not row["year"]:
                row["year"] = gb["year"]
            if gb.get("_genres_gb") and row["genres"] == "[]":
                row["genres"] = gb["_genres_gb"]

            # ── Wikidata by ISBN-13 ───────────────────────────────────────
            if not args.skip_wikidata and gb.get("_isbn13"):
                wiki = lookup_wikidata_by_isbn(gb["_isbn13"])
                time.sleep(args.delay)
                if wiki:
                    row["wiki_url"] = wiki
                    tags.append("Wiki")

            # ── Defaults ─────────────────────────────────────────────────
            if not row["type"]:
                row["type"] = "novel"   # safe default when type is unknown

            writer.writerow(row)
            out_f.flush()
            done.add(title.lower())

            print(", ".join(tags) if tags else "—")

    print(f"\n[+] Done -- {args.output}")
    print("Next: open the file in Excel / Sheets and import into your db_books spreadsheet.")


if __name__ == "__main__":
    main()
