/** Vita's reply in pieces a speech model reads in one go (Groq Orpheus: 200 characters): sentences and lines, a long sentence
 * cut at a comma or a space. Symbols that should not be read are dropped. */
export function speechChunks(text: string, max = 200): string[] {
  const clean = text.replace(/[*_#>[\]•]/g, " ").replace(/https?:\/\/\S+/g, " ");
  const sentences = clean.split(/(?<=[.!?।])\s+|\n+/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    let rest = s;
    while (rest.length > max) {
      const head = rest.slice(0, max);
      const cut = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "));
      const at = cut > max / 3 ? cut + 1 : head.lastIndexOf(" ") > max / 3 ? head.lastIndexOf(" ") : max;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  // join short neighbours so the voice doesn't pause after every few words
  const joined: string[] = [];
  for (const c of out) {
    const prev = joined.at(-1);
    if (prev && prev.length + c.length + 1 <= max && prev.length < 60) joined[joined.length - 1] = `${prev} ${c}`;
    else joined.push(c);
  }
  return joined;
}
