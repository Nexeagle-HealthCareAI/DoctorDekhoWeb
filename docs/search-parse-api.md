# Search Parse API

Turns a patient's free-text search (English / Hindi / Hinglish, typos allowed) into a structured
intent: which medical specialty, which city, and which keywords.

Source: `app/api/search/parse/route.ts`

## Endpoint

| | |
|---|---|
| Method | `POST` |
| Prod | `https://doctordekho.nexeagle.com/api/search/parse` |
| Dev | `https://doctordekho-dev.nexeagle.com/api/search/parse` |
| Auth | None |
| Headers | `Content-Type: application/json` |

Note: `nexeagle.com/api/search/parse` no longer exists (404). Use the Doctor Dekho host.

## Request

```json
{ "query": "pet mein dard hai" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `query` | string | Yes | Trimmed. Empty, missing or non-string returns 400. |

## Response 200

```json
{
  "specialtyId": "gastroenterology",
  "specialtyIds": ["gastroenterology"],
  "city": null,
  "keywords": ["pet", "mein", "dard", "hai"],
  "method": "classifier",
  "confidence": 0.9057,
  "modelVersion": "2026-08-04-083503"
}
```

```ts
interface SearchIntent {
  specialtyId: string | null;   // best match; always specialtyIds[0]; null if nothing medical
  specialtyIds: string[];       // ordered candidates (1-5); [] when specialtyId is null
  city: string | null;          // city name found in query, "NEAR_ME" for "near me / nearby / paas mein", else null
  keywords: string[];           // query words of 3+ letters (router path) or key symptom words (Groq path, max 10)
  method?: string | null;       // router path only
  confidence?: number | null;   // router path only, 0..1 similarity to nearest training example
  modelVersion?: string | null; // router path only
}
```

`specialtyId` values are the ids in `src/data/patient` (`specialties`), e.g. `gastroenterology`,
`cardiology`, `dentistry`.

### How the answer is produced

1. **NLP router** (in-house, Hinglish-tuned) is tried first. If it returns 1-3 candidates it is
   trusted and returned (`method`, `confidence`, `modelVersion` present).
2. If the router returns more candidates (it is guessing) or fails, **Groq LLM** is asked for a
   single specialty. This response has no `method`, `confidence` or `modelVersion`.
3. If Groq is unavailable, the router's broader answer (up to 5 candidates) is returned as a hedge.
4. If Groq says the query is not medical, `specialtyId` is `null` and this is honoured.

## Errors

| Status | Body | When |
|---|---|---|
| 400 | `{"error":"query is required"}` | `query` missing, empty or not a string |
| 200 | `{"notConfigured":true}` | Neither router nor Groq available |
| 502 | `{"error":"AI interpretation failed"}` | Groq failed and router gave nothing |
| 502 | `{"error":"AI returned no structured result"}` | Groq returned unparseable output |

Clients should treat `notConfigured` and 502 as "no suggestion" and fall back to plain keyword search.

## Caveats for consumers

- Non-medical text can still get a router answer. Example: `"cricket score today"` returns
  `sportsmedicine, dentistry, dermatology` with `confidence` ~0.37. Check `confidence` (and the
  number of candidates) before auto-applying a specialty filter.
- Latency is ~0.5 s on the router path; the Groq fallback has an 8 s timeout, the router 3 s.

## Example

```bash
curl -X POST https://doctordekho.nexeagle.com/api/search/parse \
  -H 'Content-Type: application/json' \
  -d '{"query":"pet mein dard hai"}'
```

## Config (server env, for whoever maintains it)

`NLP_ROUTER_BASE_URL`, `NLP_ROUTER_API_KEY` (the router's "doctordekho" key, sent as `X-Api-Key`), `GROQ_API_KEY`, `GROQ_MODEL` (default `openai/gpt-oss-20b`),
`SEARCH_ROUTER_MAX_CANDIDATES` (default 3). See `README.md` and `scripts/search-eval/README.md`.
