import { describe, expect, it } from "vitest";
import { alignCrop, clampCrop, coverScale, initialCrop, MAX_ZOOM, sourceRect, zoomCrop } from "./coverCrop";

const frame = { width: 960, height: 540 };
const wide = { width: 4000, height: 1000 };   // a panorama
const tall = { width: 1000, height: 3000 };   // a portrait photo

describe("coverScale", () => {
  it("is the smallest size that still covers the frame", () => {
    expect(coverScale(wide, frame)).toBeCloseTo(0.54);   // the height decides
    expect(coverScale(tall, frame)).toBeCloseTo(0.96);   // the width decides
  });
});

describe("initialCrop", () => {
  it("centres a wide picture sideways and fills the height", () => {
    const c = initialCrop(wide, frame);
    expect(c.zoom).toBe(1);
    expect(c.y).toBeCloseTo(0);
    expect(c.x).toBeCloseTo((960 - 4000 * 0.54) / 2);
  });
});

describe("clampCrop", () => {
  it("never leaves an empty edge: the picture always covers the frame", () => {
    const c = clampCrop({ zoom: 1, x: 500, y: 500 }, wide, frame);
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
    const far = clampCrop({ zoom: 1, x: -99999, y: -99999 }, wide, frame);
    expect(far.x).toBeCloseTo(960 - 4000 * 0.54);
  });
  it("keeps the zoom inside its limits", () => {
    expect(clampCrop({ zoom: 99, x: 0, y: 0 }, wide, frame).zoom).toBe(MAX_ZOOM);
    expect(clampCrop({ zoom: 0.1, x: 0, y: 0 }, wide, frame).zoom).toBe(1);
  });
});

describe("zoomCrop", () => {
  it("keeps the spot under the pointer where it is", () => {
    const start = initialCrop(tall, frame);
    const anchor = { x: 300, y: 200 };
    const before = { x: (anchor.x - start.x) / (coverScale(tall, frame) * start.zoom), y: (anchor.y - start.y) / (coverScale(tall, frame) * start.zoom) };
    const zoomed = zoomCrop(start, 2, anchor, tall, frame);
    const scale = coverScale(tall, frame) * zoomed.zoom;
    expect((anchor.x - zoomed.x) / scale).toBeCloseTo(before.x, 3);
    expect((anchor.y - zoomed.y) / scale).toBeCloseTo(before.y, 3);
  });
});

describe("alignCrop", () => {
  it("puts a portrait photo at its top, middle or bottom", () => {
    const base = initialCrop(tall, frame);
    const shown = 3000 * coverScale(tall, frame);
    expect(alignCrop(base, "y", "start", tall, frame).y).toBe(0);
    expect(alignCrop(base, "y", "end", tall, frame).y).toBeCloseTo(540 - shown);
    expect(alignCrop(base, "y", "center", tall, frame).y).toBeCloseTo((540 - shown) / 2);
  });
  it("does nothing along a direction where the picture fits exactly", () => {
    expect(alignCrop(initialCrop(tall, frame), "x", "start", tall, frame).x).toBeCloseTo(0);
  });
});

describe("sourceRect", () => {
  it("is the part of the real picture the frame shows, always in 16:9", () => {
    const r = sourceRect(initialCrop(tall, frame), tall, frame);
    expect(r.sw / r.sh).toBeCloseTo(16 / 9);
    expect(r.sx).toBeCloseTo(0);
    expect(r.sw).toBeCloseTo(1000);
    expect(r.sy).toBeCloseTo((3000 - r.sh) / 2);
  });
  it("shrinks the shown part as you zoom in", () => {
    const start = initialCrop(wide, frame);
    const zoomed = zoomCrop(start, 2, { x: 480, y: 270 }, wide, frame);
    expect(sourceRect(zoomed, wide, frame).sw).toBeCloseTo(sourceRect(start, wide, frame).sw / 2);
  });
});
