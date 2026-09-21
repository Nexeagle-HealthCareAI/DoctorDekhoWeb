// Ask the DEV NLP router (same one the dev container calls) about every labeled query, paced under
// its 30 req/min/IP limit, retrying on 429 so throttling can't masquerade as a "no answer".
import fs from "node:fs";
const dir = process.argv[2];
const qs = JSON.parse(fs.readFileSync(`${dir}/queries.json`, "utf8"));
const URL = (process.env.ROUTER_URL || "http://151.185.45.77:5003") + "/route-symptom";   // default: the DEV router
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
for (const item of qs) {
  let res, body, attempt = 0;
  for (;;) {
    attempt++;
    res = await fetch(URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: item.q }), signal: AbortSignal.timeout(15000) }).catch((e) => ({ status: 0, err: String(e) }));
    if (res.status === 429 && attempt < 6) { await sleep(10000); continue; }
    break;
  }
  body = res.status === 200 ? await res.json() : { error: res.status, err: res.err };
  out.push({ ...item, router: body });
  process.stdout.write(`${out.length}/${qs.length}\r`);
  await sleep(2300);
}
fs.writeFileSync(`${dir}/router.json`, JSON.stringify(out, null, 1));
console.log(`\nwrote router.json (${out.length})  non-200: ${out.filter((o) => o.router.error).length}`);
