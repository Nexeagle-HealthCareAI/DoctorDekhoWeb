import * as ImagePicker from "expo-image-picker";

/** A photo taken for Records that hasn't been uploaded yet. */
export interface PendingPhoto {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
}

let pending: PendingPhoto | null = null;

/**
 * On many budget Android phones the system closes Doctor Dekho while the camera is open. When the photo is taken the app
 * starts again on Home and the photo would be lost. Expo keeps it for us: this picks it up once, at start-up, so Records
 * can open it again ready to save.
 */
export async function recoverCameraPhoto(): Promise<boolean> {
  try {
    const r = await ImagePicker.getPendingResultAsync();
    if (!r || !("assets" in r) || r.canceled || !r.assets?.[0]) return false;
    const a = r.assets[0];
    pending = { uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? "image/jpeg", size: a.fileSize };
    return true;
  } catch {
    return false;
  }
}

/** The recovered photo, handed over once. */
export function takePendingPhoto(): PendingPhoto | null {
  const p = pending;
  pending = null;
  return p;
}
