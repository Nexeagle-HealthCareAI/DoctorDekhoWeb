import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

/** A photo taken for Records that hasn't been uploaded yet. */
export interface PendingPhoto {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
}

let pending: PendingPhoto | null = null;

/** Set while the camera or the file picker is open for Records (cleared when it returns). */
const PICKING_KEY = "dd.picking";
/** A note older than this is from some other day, not the pick that was just interrupted. */
const PICKING_FRESH_MS = 15 * 60 * 1000;

/** Call just before opening the camera or the file picker for Records. */
export async function markPicking(kind: "camera" | "file"): Promise<void> {
  await AsyncStorage.setItem(PICKING_KEY, JSON.stringify({ kind, at: Date.now() })).catch(() => {});
}

/** Call when the camera or the file picker has returned (picked or cancelled). */
export async function clearPicking(): Promise<void> {
  await AsyncStorage.removeItem(PICKING_KEY).catch(() => {});
}

/**
 * On many budget Android phones the system closes Doctor Dekho while the camera or the file picker is open (it is the
 * most likely right after an upload, while Records holds the new photo in memory). The app then starts again on Home.
 * At start-up this works out what was interrupted:
 * - "photo": Expo kept the camera's photo; Records opens it again ready to save (`takePendingPhoto`).
 * - "file": a file was being chosen; Android doesn't hand that back, so Records opens and asks to choose it again.
 * - null: nothing was interrupted.
 */
export async function recoverInterruptedPick(): Promise<"photo" | "file" | null> {
  let note: { kind?: string; at?: number } | null = null;
  try {
    const raw = await AsyncStorage.getItem(PICKING_KEY);
    note = raw ? (JSON.parse(raw) as { kind?: string; at?: number }) : null;
  } catch {
    note = null;
  }
  await clearPicking();
  try {
    const r = await ImagePicker.getPendingResultAsync();
    if (r && "assets" in r && !r.canceled && r.assets?.[0]) {
      const a = r.assets[0];
      pending = { uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? "image/jpeg", size: a.fileSize };
      return "photo";
    }
  } catch {
    // fall through to the note
  }
  const fresh = note?.at != null && Date.now() - note.at < PICKING_FRESH_MS;
  return fresh && note?.kind === "file" ? "file" : null;
}

/** The recovered photo, handed over once. */
export function takePendingPhoto(): PendingPhoto | null {
  const p = pending;
  pending = null;
  return p;
}
