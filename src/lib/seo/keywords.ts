// The phrases patients type for a doctor in a town, taken from the searches Search Console reported for this site
// ("urologist near me purnia", "top urology doctor purnia", "best urologist purnia"). Search engines give the keywords
// tag little or no weight, so the real use of these phrases is the wording of the page itself; this only lists them.

import { placeLabel } from "./placeAliases";

const ALIAS_PATTERN = /\((.+)\)/;

/** The spellings of a town: "Purnea (Purnia)" gives ["Purnea", "Purnia"]; any other place gives itself. */
export function placeSpellings(name: string): string[] {
  const label = placeLabel(name);
  const alias = ALIAS_PATTERN.exec(label)?.[1];
  return alias ? [name, alias] : [name];
}

/** Search phrases for a speciality in a town, once for each spelling of the town. */
export function specialtyCityKeywords(label: string, specialtyName: string, city: string): string[] {
  const out: string[] = [];
  for (const place of placeSpellings(city)) {
    out.push(
      `${label.toLowerCase()} in ${place}`,
      `best ${label.toLowerCase()} ${place}`,
      `top ${label.toLowerCase()} ${place}`,
      `${label.toLowerCase()} near me ${place}`,
      `${specialtyName.toLowerCase()} doctor ${place}`,
      `${specialtyName.toLowerCase()} doctor near me ${place}`,
    );
  }
  return Array.from(new Set(out));
}
