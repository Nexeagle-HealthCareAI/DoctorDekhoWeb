// Build the EXACT system prompt production sends: run the real buildSystemPrompt() (extracted from
// route.ts, types stripped) over the real specialty taxonomy (extracted from src/data/patient.ts).
import fs from "node:fs";
const root = process.argv[2], out = process.argv[3];
const route = fs.readFileSync(`${root}/app/api/search/parse/route.ts`, "utf8").replace(/\r\n/g, "\n");
const m = route.match(/function buildSystemPrompt\(\): string \{([\s\S]*?)\n\}\n/);
if (!m) throw new Error("buildSystemPrompt not found");
const body = m[1];
const data = fs.readFileSync(`${root}/src/data/patient.ts`, "utf8").replace(/\r\n/g, "\n");
const start = data.indexOf("export const specialties"); const blk = data.slice(start, data.indexOf("];", start));
const specialties = []; const re = /id:\s*"([^"]+)"[^}]*?name:\s*"([^"]+)"[^}]*?blurb:\s*"([^"]+)"/g; let x;
while ((x = re.exec(blk))) specialties.push({ id: x[1], name: x[2], blurb: x[3] });
const prompt = new Function("specialties", body)(specialties);
fs.writeFileSync(out, prompt); console.log(`specialties: ${specialties.length}, prompt chars: ${prompt.length}`);
console.log("---- head ----\n" + prompt.slice(0, 260) + "\n---- tail ----\n" + prompt.slice(-330));
