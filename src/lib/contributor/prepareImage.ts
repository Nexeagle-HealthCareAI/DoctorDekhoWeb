// Makes a photo ready to upload: any phone photo becomes small enough, the way the picture was taken (rotation) is kept, and the details a
// camera hides in a file (such as where it was taken) are left behind. The same file is in Doctor Dekho and in the CMS.
//
// The server accepts JPG, PNG and WebP up to 2 MB. People pick photos of 3 to 10 MB, often HEIC from an iPhone. This turns them into a
// WebP (or a JPEG where the browser cannot write WebP) of at most 1600 px wide, and says plainly when it cannot.

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export const MAX_EDGE = 1600;
// Under the server's 2 MB limit, with room for the multipart wrapper.
export const TARGET_BYTES = 1_800_000;
// Bigger than this is refused before the browser tries to open it (a 25 MB photo already needs ~200 MB of memory to decode).
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const PLAIN_TYPES = ["image/jpeg", "image/png", "image/webp"];
const HEIC_TYPES = ["image/heic", "image/heif"];

/** A reason to show the person, in words they can act on. */
export class ImageProblem extends Error {}

/** The size of a picture that fits inside `max` on its longer side, never larger than it is now. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const typeOf = (file: File): string => {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "heic" ? "image/heic" : ext === "heif" ? "image/heif" : "";
};

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    // The browser applies the photo's rotation when it opens the file.
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // Older browsers: open it as a picture instead.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
    } catch {
      throw new ImageProblem(HEIC_TYPES.includes(typeOf(file))
        ? "This browser cannot open iPhone (HEIC) photos. Open the photo in Safari, or save it as a JPG first."
        : "That file could not be opened as a picture. Try another one.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Throws an ImageProblem when a chosen file cannot be used at all (wrong kind, or far too big). */
export function checkImageFile(file: File): void {
  const type = typeOf(file);
  if (!PLAIN_TYPES.includes(type) && !HEIC_TYPES.includes(type)) throw new ImageProblem("Use a JPG, PNG or WebP picture, or an iPhone (HEIC) photo.");
  if (file.size > MAX_INPUT_BYTES) throw new ImageProblem(`That file is ${megabytes(file.size)}. The limit is 25 MB.`);
}

/** Opens a chosen file as a picture (the way the photo was taken is applied), or throws an ImageProblem. Close it when done. */
export const openImage = decode;

/**
 * Writes a canvas as a WebP (or a JPEG where the browser cannot write WebP) that is small enough for the server, or returns null when
 * even the lowest quality is too large. The caller then tries a smaller canvas.
 */
export async function encodeCanvas(canvas: HTMLCanvasElement, baseName: string): Promise<File | null> {
  let outType = "image/webp";
  let blob = await toBlob(canvas, outType, 0.85);
  if (!blob || blob.type !== "image/webp") {
    // The browser handed back a PNG: write a JPEG instead, on a white ground (a JPEG has no transparency).
    outType = "image/jpeg";
    const flat = document.createElement("canvas");
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    canvas = flat;
    blob = await toBlob(canvas, outType, 0.85);
  }
  for (const quality of [0.75, 0.65, 0.55]) {
    if (blob && blob.size <= TARGET_BYTES) break;
    blob = await toBlob(canvas, outType, quality);
  }
  if (!blob || blob.size > TARGET_BYTES) return null;
  const base = baseName.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.${outType === "image/webp" ? "webp" : "jpg"}`, { type: outType });
}

/** Prepares a chosen file for upload, or throws an ImageProblem that says what to do. */
export async function prepareImage(file: File): Promise<File> {
  checkImageFile(file);
  const type = typeOf(file);

  const picture = await decode(file);
  try {
    const { width: w0, height: h0 } = picture;
    if (!w0 || !h0) throw new ImageProblem("That file could not be opened as a picture. Try another one.");

    // A small PNG or WebP that is not too wide goes up as it is. A JPEG always goes through the canvas: that is what removes the hidden camera details.
    const small = (type === "image/png" || type === "image/webp") && file.size <= TARGET_BYTES && Math.max(w0, h0) <= MAX_EDGE;
    if (small) return file;

    let edge = MAX_EDGE;
    for (let shrink = 0; shrink < 4; shrink++) {
      const { width, height } = fitWithin(w0, h0, edge);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ImageProblem("This browser cannot get the picture ready. Try another browser.");
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(picture.source, 0, 0, width, height);
      const out = await encodeCanvas(canvas, file.name);
      if (out) return out;
      edge = Math.round(edge * 0.75);
    }
    throw new ImageProblem("That picture is still too large after it was made smaller. Try a simpler picture.");
  } finally {
    picture.close();
  }
}
