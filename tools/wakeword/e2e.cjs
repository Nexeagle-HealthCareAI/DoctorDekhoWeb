// End-to-end: Chromium with a fake microphone playing a WAV (silence, "Hey Vita", silence, looped). With the wake word turned
// on, the Vita panel must open and the voice conversation start; with only other speech, it must not.
//   node e2e.cjs <base url> <wav> <expect: open|closed> [seconds]
const { chromium } = require("playwright");

(async () => {
  const [base, wav, expect, secs] = process.argv.slice(2);
  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`,
      "--autoplay-policy=no-user-gesture-required"],
  });
  const ctx = await browser.newContext({ permissions: ["microphone"] });
  await ctx.addInitScript(() => {
    localStorage.setItem("vita_prefs", JSON.stringify({ textSize: "normal", readAloud: false, wakeWord: true }));
    localStorage.setItem("vita_seen", "1");
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto(`${base}/?wakedebug=1`, { waitUntil: "domcontentloaded" });
  await page.mouse.click(5, 300);                                      // a tap, as a person would have made
  const t0 = Date.now();
  let status = "";
  const scores = [];
  const deadline = t0 + Number(secs || 40) * 1000;
  let opened = false;
  while (Date.now() < deadline) {
    status = (await page.locator("text=/^wake /").first().textContent().catch(() => "")) || status;
    const m = /wake (\S+) ([\d.]+)/.exec(status);
    if (m) scores.push(Number(m[2]));
    opened = await page.getByRole("dialog").isVisible().catch(() => false);
    if (opened) break;
    await page.waitForTimeout(100);
  }
  let live = false;
  let note = "";
  if (opened) {
    live = await page.getByRole("button", { name: /stop talking/i }).waitFor({ timeout: 8000 }).then(() => true, () => false);
    note = await page.locator("[role=status]").allTextContents().then((a) => a.join(" | ")).catch(() => "");
  }
  console.log(JSON.stringify({ expect, opened, live, afterSeconds: (Date.now() - t0) / 1000, lastStatus: status, note,
    maxScore: Math.max(0, ...scores) }));
  if (logs.some((l) => /wake word|error/i.test(l))) console.log(logs.filter((l) => /wake|error|ort/i.test(l)).slice(0, 15).join("\n"));
  await browser.close();
  process.exit((expect === "open") === opened ? 0 : 1);
})();
