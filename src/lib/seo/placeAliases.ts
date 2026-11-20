// Patients type "Purnia" far more often than the official "Purnea", so a page about Purnea names both. Only the
// words on the page change: URLs, filters and the doctors' own city strings keep the official spelling.

const ALIASES: Record<string, string> = { purnea: "Purnia" };

/** "Purnea (Purnia)" for a city people spell two ways; any other place comes back unchanged. */
export function placeLabel(name: string): string {
  const alias = ALIASES[name.trim().toLowerCase()];
  return alias ? `${name} (${alias})` : name;
}
