// Choosing which part of a picture becomes the 16:9 cover. The math here works in the pixels of the crop window (the "frame") on screen, and
// turns that into a rectangle of the real picture, so what the person sees in the window is what gets saved. The same file is in Doctor
// Dekho and in the CMS.

import { ImageProblem, MAX_EDGE, encodeCanvas } from "./prepareImage";

export const COVER_WIDTH = MAX_EDGE; // 1600
export const COVER_HEIGHT = Math.round((MAX_EDGE * 9) / 16); // 900
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export interface Size { width: number; height: number }
/** zoom: 1 = the picture just covers the frame, 2 = twice as large. x and y: where the picture's top left corner sits in the frame (0 or less). */
export interface Crop { zoom: number; x: number; y: number }

/** The size, on screen, of the picture at zoom 1: the smallest that still covers the frame. */
export const coverScale = (image: Size, frame: Size) => Math.max(frame.width / image.width, frame.height / image.height);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Keeps the picture covering the whole frame, so there is never an empty edge in the cover. */
export function clampCrop(crop: Crop, image: Size, frame: Size): Crop {
  const zoom = clamp(crop.zoom, MIN_ZOOM, MAX_ZOOM);
  const scale = coverScale(image, frame) * zoom;
  const shownW = image.width * scale;
  const shownH = image.height * scale;
  return {
    zoom,
    x: clamp(crop.x, Math.min(0, frame.width - shownW), 0),
    y: clamp(crop.y, Math.min(0, frame.height - shownH), 0),
  };
}

/** The picture centred and as large as the frame needs. */
export const initialCrop = (image: Size, frame: Size): Crop => alignCrop(alignCrop({ zoom: 1, x: 0, y: 0 }, "x", "center", image, frame), "y", "center", image, frame);

/** Zooms while the point under (anchorX, anchorY) in the frame stays where it is, so zooming feels like looking closer at that spot. */
export function zoomCrop(crop: Crop, zoom: number, anchor: { x: number; y: number }, image: Size, frame: Size): Crop {
  const from = coverScale(image, frame) * crop.zoom;
  const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const to = coverScale(image, frame) * next;
  const px = (anchor.x - crop.x) / from;
  const py = (anchor.y - crop.y) / from;
  return clampCrop({ zoom: next, x: anchor.x - px * to, y: anchor.y - py * to }, image, frame);
}

/** Puts the picture against one side, or in the middle, along one direction. */
export function alignCrop(crop: Crop, axis: "x" | "y", where: "start" | "center" | "end", image: Size, frame: Size): Crop {
  const scale = coverScale(image, frame) * clamp(crop.zoom, MIN_ZOOM, MAX_ZOOM);
  const room = (axis === "x" ? frame.width - image.width * scale : frame.height - image.height * scale); // 0 or less
  const at = where === "start" ? 0 : where === "end" ? room : room / 2;
  return clampCrop({ ...crop, [axis]: at }, image, frame);
}

/** The part of the real picture that the frame shows. */
export function sourceRect(crop: Crop, image: Size, frame: Size) {
  const c = clampCrop(crop, image, frame);
  const scale = coverScale(image, frame) * c.zoom;
  return { sx: -c.x / scale, sy: -c.y / scale, sw: frame.width / scale, sh: frame.height / scale };
}

/** Paints the crop into a canvas of any size with the frame's shape. */
export function paintCrop(ctx: CanvasRenderingContext2D, source: CanvasImageSource, crop: Crop, image: Size, frame: Size, to: Size) {
  const { sx, sy, sw, sh } = sourceRect(crop, image, frame);
  ctx.clearRect(0, 0, to.width, to.height);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, to.width, to.height);
}

/** The cover as a file ready to upload: 1600 x 900, small enough for the server. */
export async function renderCover(source: CanvasImageSource, crop: Crop, image: Size, frame: Size, name: string): Promise<File> {
  let width = COVER_WIDTH;
  for (let shrink = 0; shrink < 3; shrink++) {
    const height = Math.round((width * 9) / 16);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageProblem("This browser cannot get the picture ready. Try another browser.");
    paintCrop(ctx, source, crop, image, frame, { width, height });
    const file = await encodeCanvas(canvas, name);
    if (file) return file;
    width = Math.round(width * 0.75);
  }
  throw new ImageProblem("That picture is still too large after it was made smaller. Try a simpler picture.");
}
