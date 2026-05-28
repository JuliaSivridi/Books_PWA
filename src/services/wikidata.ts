// Wikidata SPARQL — lookup Wikipedia URL by ISBN-13.
// P212 = ISBN-13 in Wikidata.
// Russian Wikipedia preferred; English as fallback.

const SPARQL = 'https://query.wikidata.org/sparql'

export async function lookupByIsbn(isbn13: string): Promise<{ wiki_url: string | null }> {
  const query = `
SELECT ?item ?ruWiki ?enWiki WHERE {
  ?item wdt:P212 "${isbn13}" .
  OPTIONAL { ?ruWiki schema:about ?item; schema:isPartOf <https://ru.wikipedia.org/> }
  OPTIONAL { ?enWiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
}
LIMIT 1`

  try {
    const res = await fetch(
      `${SPARQL}?query=${encodeURIComponent(query)}&format=json`,
      { headers: { Accept: 'application/sparql-results+json' } },
    )
    if (!res.ok) return { wiki_url: null }

    const data = await res.json() as {
      results: {
        bindings: Array<{
          ruWiki?: { value: string }
          enWiki?: { value: string }
        }>
      }
    }
    const b = data.results?.bindings?.[0]
    if (!b) return { wiki_url: null }
    return { wiki_url: b.ruWiki?.value ?? b.enWiki?.value ?? null }
  } catch {
    return { wiki_url: null }
  }
}
