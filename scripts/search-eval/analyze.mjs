import fs from "node:fs";
const dir = process.argv[2];
const router = JSON.parse(fs.readFileSync(`${dir}/router.json`, "utf8"));
const groqLines = fs.readFileSync(`${dir}/groq-raw.txt`, "utf8").split("\n").filter((l) => l.startsWith("EVAL\t"));
const groq = new Map(groqLines.map((l) => { const [, q, j] = l.split("\t"); let id = null; try { id = JSON.parse(j).specialtyId ?? null; } catch {} return [q, id]; }));
if (fs.existsSync(dir + "/groq-log.txt")) console.log("real 429 retries during the Groq run:", fs.readFileSync(`${dir}/groq-log.txt`, "utf8").split("\n").filter((l) => /\(429 on query/.test(l)).length);

const rows = router.map((r) => {
  const ids = r.router.specialtyIds ?? []; const top = ids[0] ?? null;
  const conf = r.router.confidence ?? r.router.raw?.matchRatio ?? null;
  const okSet = new Set(r.ok);
  const none = r.cat === "none";
  const correct = (id) => (none ? id == null : id != null && okSet.has(id));
  return { q: r.q, cat: r.cat, ok: r.ok, top, n: ids.length, conf, noMatch: !!r.router.noMatch, gib: !!r.router.raw?.flaggedGibberish,
           routerOk: correct(top), groqId: groq.get(r.q) ?? null, groqOk: correct(groq.get(r.q) ?? null), closest: r.router.raw?.closestKnownExample };
});
const pct = (a, b) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : "n/a");
const f = (x) => (x == null ? "  -  " : x.toFixed(2));

// ---- 1) Overall
const all = rows.length, rOk = rows.filter((r) => r.routerOk).length, gOk = rows.filter((r) => r.groqOk).length;
console.log(`\n=== OVERALL  router ${pct(rOk, all)}   groq(gpt-oss-20b) ${pct(gOk, all)}`);
for (const cat of ["english", "hinglish", "typo", "multi", "none"]) {
  const s = rows.filter((r) => r.cat === cat);
  console.log(`  ${cat.padEnd(9)} router ${pct(s.filter((r) => r.routerOk).length, s.length).padEnd(12)} groq ${pct(s.filter((r) => r.groqOk).length, s.length)}`);
}

// ---- 2) Every query where the router is wrong or the two disagree
console.log("\n=== ROUTER WRONG (or no answer where an answer was expected)");
console.log("conf  n  router-top                expected                          groq");
for (const r of rows.filter((r) => !r.routerOk)) {
  console.log(`${f(r.conf)}  ${r.n}  ${String(r.top).padEnd(24)} ${(r.cat === "none" ? "(no suggestion)" : r.ok.join("|")).slice(0, 32).padEnd(33)} ${r.groqId} ${r.groqOk ? "✓" : "✗"}   « ${r.q}`);
}
console.log("\n=== GROQ WRONG");
for (const r of rows.filter((r) => !r.groqOk)) console.log(`groq=${r.groqId}  expected=${r.cat === "none" ? "(none)" : r.ok.join("|")}  router=${r.top}(${f(r.conf)}) ${r.routerOk ? "router ✓" : "router ✗"}  « ${r.q}`);

// ---- 3) Does confidence separate right from wrong?
console.log("\n=== ROUTER ACCURACY BY match_ratio (confidence) BUCKET");
const bins = [[0, 0.3], [0.3, 0.4], [0.4, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 1.01]];
for (const [lo, hi] of bins) { const s = rows.filter((r) => r.conf != null && r.conf >= lo && r.conf < hi); if (s.length) console.log(`  [${lo.toFixed(1)}, ${Math.min(hi, 1).toFixed(1)})  n=${String(s.length).padStart(2)}  router ${pct(s.filter((r) => r.routerOk).length, s.length).padEnd(11)} groq ${pct(s.filter((r) => r.groqOk).length, s.length)}`); }
const noConf = rows.filter((r) => r.conf == null); if (noConf.length) console.log(`  (no confidence) n=${noConf.length}  router ${pct(noConf.filter((r) => r.routerOk).length, noConf.length)}`);

console.log("\n=== ROUTER ACCURACY BY NUMBER OF CANDIDATES RETURNED");
for (const n of [...new Set(rows.map((r) => r.n))].sort((a, b) => a - b)) { const s = rows.filter((r) => r.n === n); console.log(`  ${n} candidate(s)  n=${String(s.length).padStart(2)}  router ${pct(s.filter((r) => r.routerOk).length, s.length)}`); }

// ---- 4) Policy simulation: use router iff conf >= T (and it produced an answer), else Groq
console.log("\n=== POLICY: use router when confidence >= T, else Groq   (accuracy over all 71; share sent to Groq)");
console.log("   T     accuracy     to-groq   router-wrong-kept  groq-wrong-when-used");
for (const T of [0, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 1.01]) {
  let ok = 0, toG = 0, rwk = 0, gwu = 0;
  for (const r of rows) { const useRouter = r.conf != null && r.conf >= T && r.top != null; if (useRouter) { ok += r.routerOk; if (!r.routerOk) rwk++; } else { toG++; ok += r.groqOk; if (!r.groqOk) gwu++; } }
  console.log(`  ${T === 1.01 ? "always-Groq" : T.toFixed(2).padStart(5)}  ${pct(ok, all).padEnd(12)} ${pct(toG, all).padEnd(11)} ${String(rwk).padStart(4)}            ${String(gwu).padStart(4)}`);
}
fs.writeFileSync(`${dir}/joined.json`, JSON.stringify(rows, null, 1));
