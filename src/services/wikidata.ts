// Wikidata SPARQL — lookup by ISBN-13.
// P212  = ISBN-13
// P5699 = FantLab work ID
// Russian Wikipedia preferred; English as fallback.

const SPARQL = 'https://query.wikidata.org/sparql'

export interface WikidataResult {
  wiki_url:   string | null
  fl_work_id: string | null
}

export async function lookupByIsbn(isbn13: string): Promise<WikidataResult> {
  const query = `
SELECT ?ruWiki ?enWiki ?fantlabId WHERE {
  ?item wdt:P212 "${isbn13}" .
  OPTIONAL { ?ruWiki schema:about ?item; schema:isPartOf <https://ru.wikipedia.org/> }
  OPTIONAL { ?enWiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?item wdt:P5699 ?fantlabId }
}
LIMIT 1`

  try {
    const res = await fetch(
      `${SPARQL}?query=${encodeURIComponent(query)}&format=json`,
      { headers: { Accept: 'application/sparql-results+json' } },
    )
    if (!res.ok) return { wiki_url: null, fl_work_id: null }

    const data = await res.json() as {
      results: {
        bindings: Array<{
          ruWiki?:    { value: string }
          enWiki?:    { value: string }
          fantlabId?: { value: string }
        }>
      }
    }
    const b = data.results?.bindings?.[0]
    if (!b) return { wiki_url: null, fl_work_id: null }
    return {
      wiki_url:   b.ruWiki?.value ?? b.enWiki?.value ?? null,
      fl_work_id: b.fantlabId?.value ?? null,
    }
  } catch {
    return { wiki_url: null, fl_work_id: null }
  }
}
