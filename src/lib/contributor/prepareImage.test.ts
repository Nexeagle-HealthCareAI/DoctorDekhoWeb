import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageProblem, fitWithin, prepareImage } from "./prepareImage";

const file = (name: string, type: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type });

let bitmap = { width: 4000, height: 3000, close: vi.fn() };
let writes: { type: string; quality: number }[] = [];
let sizeFor: (type: string, quality: number) => number = () => 400_000;
let canWebp = true;

beforeEach(() => {
  bitmap = { width: 4000, height: 3000, close: vi.fn() };
  writes = [];
  sizeFor = () => 400_000;
  canWebp = true;
  vi.stubGlobal("createImageBitmap", async () => bitmap);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ clearRect: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: "" } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb, type = "image/png", quality = 0.92) {
    const out = type === "image/webp" && !canWebp ? "image/png" : type;
    writes.push({ type: out, quality: quality as number });
    cb(new Blob([new Uint8Array(sizeFor(out, quality as number))], { type: out }));
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("fitWithin", () => {
  it("shrinks the longer side to the limit and keeps the shape", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });
  it("never makes a picture larger", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("prepareImage", () => {
  it("turns a big phone photo into a small WebP of at most 1600 px", async () => {
    const out = await prepareImage(file("IMG_0001.jpg", "image/jpeg", 7_000_000));
    expect(out.type).toBe("image/webp");
    expect(out.name).toBe("IMG_0001.webp");
    expect(out.size).toBeLessThanOrEqual(1_800_000);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("opens an iPhone HEIC photo where the browser can read it", async () => {
    const out = await prepareImage(file("IMG_0002.HEIC", "", 5_000_000));
    expect(out.type).toBe("image/webp");
  });

  it("uses JPEG where the browser cannot write WebP", async () => {
    canWebp = false;
    const out = await prepareImage(file("a.png", "image/png", 6_000_000));
    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("a.jpg");
  });

  it("lowers the quality, and then the size, until the picture fits", async () => {
    sizeFor = (_t, q) => (q >= 0.85 ? 3_000_000 : q >= 0.75 ? 2_500_000 : q >= 0.65 ? 2_000_000 : 1_500_000);
    const out = await prepareImage(file("big.jpg", "image/jpeg", 9_000_000));
    expect(out.size).toBeLessThanOrEqual(1_800_000);
    expect(writes.map((w) => w.quality)).toEqual([0.85, 0.75, 0.65, 0.55]);
  });

  it("sends a small PNG that is not too wide as it is", async () => {
    bitmap = { width: 800, height: 600, close: vi.fn() };
    const png = file("logo.png", "image/png", 90_000);
    expect(await prepareImage(png)).toBe(png);
    expect(writes).toHaveLength(0);
  });

  it("always rebuilds a JPEG, which also leaves the camera details behind", async () => {
    bitmap = { width: 800, height: 600, close: vi.fn() };
    const out = await prepareImage(file("small.jpg", "image/jpeg", 90_000));
    expect(writes.length).toBeGreaterThan(0);
    expect(out.name).toBe("small.webp");
  });

  it("says plainly when the file is not a picture it accepts", async () => {
    await expect(prepareImage(file("notes.pdf", "application/pdf", 1000))).rejects.toThrow(ImageProblem);
    await expect(prepareImage(file("anim.gif", "image/gif", 1000))).rejects.toThrow(/JPG, PNG or WebP/);
  });

  it("refuses a file that is far too big before opening it", async () => {
    await expect(prepareImage(file("huge.jpg", "image/jpeg", 26 * 1024 * 1024))).rejects.toThrow(/25 MB/);
  });

  it("explains a picture the browser cannot open", async () => {
    vi.stubGlobal("createImageBitmap", async () => { throw new Error("cannot decode"); });
    await expect(prepareImage(file("IMG_9.heic", "image/heic", 3_000_000))).rejects.toThrow(/HEIC/);
  });
});
