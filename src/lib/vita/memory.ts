"use client";

// What the chat keeps on this device between visits:
// - the conversation, for 24 hours after the last message, so closing the tab does not lose it
//   ("Continue where you left off"). "New chat" deletes it at once.
// - the patient's last few searches, for 7 days, shown on the chat's home screen.
// Nothing here leaves the device. Private browsing or blocked storage: the chat simply starts fresh.

const CHAT_KEY = "vita_chat";
const RECENT_KEY = "vita_recent";
export const CHAT_TTL_MS = 24 * 60 * 60 * 1000;
const RECENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 60;
const MAX_RECENT = 5;

export interface SavedChat<E> {
  savedAt: number;
  sessionId: string | null;
  entries: E[];
}

export function loadChat<E>(now = Date.now()): SavedChat<E> | null {
  try {
    const raw = window.localStorage.getItem(CHAT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedChat<E>;
    if (!saved || !Array.isArray(saved.entries) || now - saved.savedAt > CHAT_TTL_MS) {
      window.localStorage.removeItem(CHAT_KEY);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

export function saveChat<E>(entries: E[], sessionId: string | null, now = Date.now()) {
  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(CHAT_KEY);
      return;
    }
    const saved: SavedChat<E> = { savedAt: now, sessionId, entries: entries.slice(-MAX_ENTRIES) };
    window.localStorage.setItem(CHAT_KEY, JSON.stringify(saved));
  } catch {
    /* storage full or blocked: keep going without it */
  }
}

export function clearChat() {
  try {
    window.localStorage.removeItem(CHAT_KEY);
  } catch {
    /* ignore */
  }
}

interface Recent {
  text: string;
  at: number;
}

export function loadRecent(now = Date.now()): string[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as Recent[];
    return list.filter((r) => now - r.at <= RECENT_TTL_MS).map((r) => r.text);
  } catch {
    return [];
  }
}

/** Remember something the patient typed (not chip taps), newest first, no repeats. */
export function addRecent(text: string, now = Date.now()) {
  const clean = text.trim();
  if (clean.length < 3 || clean.length > 80) return;
  try {
    const list = (JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as Recent[])
      .filter((r) => r.text.toLowerCase() !== clean.toLowerCase() && now - r.at <= RECENT_TTL_MS);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify([{ text: clean, at: now }, ...list].slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

export function clearRecent() {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}
