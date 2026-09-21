# Search-routing evaluation

Evidence (and the tooling to redo it) for the rule in `app/api/search/parse/route.ts`: **trust the NLP
router only when it returns ≤ 3 candidate specialties, otherwise ask Groq.**

Free-text search first asks our NLP router (a TF-IDF classifier that returns a ranked candidate list),
then falls back to an LLM (Groq). The router is free and keeps the patient's text in-house, but on
many queries it is guessing. This folder measures *when* — against hand-labelled queries.

## Result (2026-09-21, router model `2026-08-04-083503`, Groq `openai/gpt-oss-20b`)

`queries-set1.json` (71) was used to find the rule; `queries-set2.json` (50, written afterwards) was
scored with the rule fixed in advance.

| | set 1 (71) | set 2, unseen (50) |
|---|---|---|
| Router alone | 80% | 68% |
| **Router if ≤ 3 candidates, else Groq** | 99% | **100%** |
| Router if `match_ratio` ≥ 0.6, else Groq | 99% | 96% |
| Groq alone | 99% | 100% |

- Answers with 1–3 candidates: **40/40 correct** across both sets. With 5 candidates: ~50–67%.
  Every one of the router's 30 errors had 5 candidates.
- `match_ratio` (returned as `confidence`) is the cosine similarity to the nearest *training example*,
  not the classifier's certainty. It separated right from wrong poorly and a wrong answer appeared at 0.80.
- With the rule, ~70% of these free-text queries still go to Groq — the router is genuinely undecided
  on most of them. When Groq is unavailable the route falls back to the router's broad answer.

Caveats: 121 queries labelled by one person (`ok` = every specialty that would be a reasonable answer;
`ok: []` means "no suggestion is correct"), so treat percentages as indicative.

## Re-running it (do this if the router is retrained or its candidate settings change)

```bash
W=/tmp/eval && mkdir -p $W && cp scripts/search-eval/queries-set2.json $W/queries.json

# 1) the router's answers (dev router by default; ROUTER_URL=https://nlp-api.nexeagle.com for prod).
#    Paced under its 30 req/min/IP limit.
node scripts/search-eval/collect-router.mjs $W                   # -> $W/router.json

# 2) the EXACT system prompt production sends (runs the real buildSystemPrompt over the real taxonomy)
node scripts/search-eval/build-prompt.mjs . $W/system-prompt.txt

# 3) Groq's answers, from the GitHub runner (the key lives in the repo secret) — manual workflow "Check — Groq key"
node -e 'const fs=require("fs"),W=process.argv[1];fs.writeFileSync(W+"/inputs.json",JSON.stringify({model:"openai/gpt-oss-20b",system:fs.readFileSync(W+"/system-prompt.txt","utf8"),queries:JSON.parse(fs.readFileSync(W+"/queries.json","utf8")).map(x=>x.q).join("\n")}))' $W
gh workflow run check-groq.yml --ref main --json < $W/inputs.json
# when it finishes: save the log, and keep the tab-separated EVAL lines
gh run view <run-id> --log > $W/groq-log.txt
sed -E 's/^[^\t]*\t[^\t]*\t//; s/^[0-9T:.Z-]+ //' $W/groq-log.txt | grep -a '^EVAL' | tr -d '\r' > $W/groq-raw.txt

# 4) compare
node scripts/search-eval/analyze.mjs $W            # accuracy by category / confidence bucket / candidate count; writes joined.json
node scripts/search-eval/analyze-policies.mjs $W   # candidate-list recall + the routing policies side by side
```

Groq's free tier rate-limits (~25 requests/min at this prompt size); the workflow retries on 429.
