import fs from "node:fs";
const dir = process.argv[2];
const router = JSON.parse(fs.readFileSync(`${dir}/router.json`, "utf8"));
const rows = JSON.parse(fs.readFileSync(`${dir}/joined.json`, "utf8"));
const byQ = new Map(router.map((r) => [r.q, r.router.specialtyIds ?? []]));
const pct = (a, b) => `${a}/${b} (${Math.round((100 * a) / b)}%)`;

// A) For the router's wrong-top answers on symptom queries: is the right specialty still among the candidates?
const wrongSym = rows.filter((r) => !r.routerOk && r.cat !== "none");
const recovered = wrongSym.filter((r) => byQ.get(r.q).some((id) => r.ok.includes(id)));
console.log(`A) router wrong-top on symptom queries: ${wrongSym.length}; right specialty still inside its candidate list: ${pct(recovered.length, wrongSym.length)}`);
for (const r of wrongSym) console.log(`   ${byQ.get(r.q).some((id) => r.ok.includes(id)) ? "IN LIST " : "MISSING "} ${r.q}   [${byQ.get(r.q).join(", ")}]`);
const noneShown = rows.filter((r) => r.cat === "none" && r.n > 0);
console.log(`   non-medical queries where the router still showed ${noneShown.length} specialties each: ${noneShown.map((r) => r.q).join(" | ")}`);

// B) Combined policies
const policies = {
  "P0 router always (today)":                     (r) => r.n > 0,
  "P1 conf >= 0.60":                              (r) => r.n > 0 && r.conf >= 0.6,
  "P2 candidates <= 3":                           (r) => r.n >= 1 && r.n <= 3,
  "P3 candidates <= 3  OR conf >= 0.80":          (r) => r.n > 0 && (r.n <= 3 || r.conf >= 0.8),
  "P4 candidates <= 3  OR conf >= 0.70":          (r) => r.n > 0 && (r.n <= 3 || r.conf >= 0.7),
  "P5 candidates == 1":                           (r) => r.n === 1,
  "P6 always Groq":                               () => false,
};
console.log("\nB) policy                                  accuracy      to-Groq     router-wrong-kept   groq-wrong-when-used");
for (const [name, useRouter] of Object.entries(policies)) {
  let ok = 0, toG = 0, rwk = 0, gwu = 0;
  for (const r of rows) { if (useRouter(r)) { ok += r.routerOk; if (!r.routerOk) rwk++; } else { toG++; ok += r.groqOk; if (!r.groqOk) gwu++; } }
  console.log(`   ${name.padEnd(42)} ${pct(ok, rows.length).padEnd(13)} ${pct(toG, rows.length).padEnd(11)} ${String(rwk).padStart(3)}                 ${String(gwu).padStart(3)}`);
}
// C) which queries does P3 keep on the router (so I can eyeball them)?
console.log("\nC) P3 keeps on router:", rows.filter(policies["P3 candidates <= 3  OR conf >= 0.80"]).length, " -> by n:", JSON.stringify(rows.filter(policies["P3 candidates <= 3  OR conf >= 0.80"]).reduce((a, r) => (a[r.n] = (a[r.n] || 0) + 1, a), {})));
