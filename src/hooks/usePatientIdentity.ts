"use client";

import { usePatientAuth } from "@/hooks/usePatientAuth";
import { usePatientProfile } from "@/hooks/usePatientProfile";
import { useContributorTag } from "@/hooks/useContributorTag";

// Letters and digits of the scripts the site is used in (Latin, Devanagari, Bengali); a bracket or a dot is not one.
const WORD_CHAR = /[A-Za-z0-9\u00C0-\u024F\u0900-\u097F\u0980-\u09FF]/;
const TITLES = new Set(["dr", "mr", "mrs", "ms", "miss", "prof"]);

/** Up to two letters from the name: the first letters of its first two real words (a title such as "Dr." or a bracket is skipped). */
export const initialsOf = (name: string) => {
  const words = name.split(/\s+/).filter((w) => WORD_CHAR.test(w) && !TITLES.has(w.replace(/\./g, "").toLowerCase()));
  const picked = (words.length ? words : name.split(/\s+/)).slice(0, 2);
  return picked.map((w) => (w.match(WORD_CHAR)?.[0] ?? "").toUpperCase()).join("") || "P";
};

/**
 * Who is signed in, for the places that show them (top bar menu, profile): the contributor's own name when the number belongs to a
 * contributor, else the name from their bookings, else nothing. Everything is read only once they are signed in.
 */
export function usePatientIdentity() {
  const auth = usePatientAuth();
  const profile = usePatientProfile(auth.isLoggedIn).data;
  const tag = useContributorTag(auth.isLoggedIn).data;

  const name = (tag?.isContributor ? tag.fullName : null) || profile?.fullName?.trim() || null;
  const initials = name ? initialsOf(name) : auth.mobile ? auth.mobile.slice(-2) : "P";

  return { ...auth, name, initials, tag };
}
