"use client";

import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, ChevronsUpDown, ZoomIn, ZoomOut } from "lucide-react";
import { ImageProblem, openImage } from "@/lib/contributor/prepareImage";
import { MAX_ZOOM, MIN_ZOOM, alignCrop, clampCrop, coverScale, initialCrop, paintCrop, renderCover, zoomCrop, type Crop, type Size } from "@/lib/contributor/coverCrop";
import { primaryBtn, secondaryBtn } from "./ui";

// The crop window, in its own units. The canvas is drawn at this size and shown smaller on a narrow screen.
const FRAME: Size = { width: 960, height: 540 };

interface Props {
  file: File;
  /** The cropped cover, ready to upload. */
  onApply: (cover: File) => void;
  /** Use the whole picture, made small but not cropped. */
  onSkip: () => void;
  onCancel: () => void;
  /** The picture could not be opened. */
  onError: (message: string) => void;
}

const SMALL_BTN = `${secondaryBtn} !px-3 !py-2 !text-xs`;

/** Choose which part of a picture is the 16:9 cover: drag it, zoom, or put it against a side. What the window shows is what is saved. */
export default function CoverCropDialog({ file, onApply, onSkip, onCancel, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [picture, setPicture] = useState<{ source: CanvasImageSource; size: Size; close: () => void } | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Open the picture once.
  useEffect(() => {
    let alive = true;
    let opened: { close: () => void } | null = null;
    openImage(file)
      .then((p) => {
        opened = p;
        if (!alive) return p.close();
        const size = { width: p.width, height: p.height };
        setPicture({ source: p.source, size, close: p.close });
        setCrop(initialCrop(size, FRAME));
      })
      .catch((e: unknown) => alive && onError(e instanceof ImageProblem ? e.message : "That file could not be opened as a picture. Try another one."));
    return () => { alive = false; opened?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Draw what the window shows.
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (ctx && picture) paintCrop(ctx, picture.source, crop, picture.size, FRAME, FRAME);
  }, [picture, crop]);

  const size = picture?.size;
  const set = (next: Crop) => size && setCrop(clampCrop(next, size, FRAME));
  const zoomTo = (zoom: number, anchor = { x: FRAME.width / 2, y: FRAME.height / 2 }) => size && setCrop((c) => zoomCrop(c, zoom, anchor, size, FRAME));

  // Scrolling zooms where the pointer is. It has to be a real listener: a React wheel handler cannot stop the page from scrolling.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !size) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const anchor = { x: ((e.clientX - r.left) / r.width) * FRAME.width, y: ((e.clientY - r.top) / r.height) * FRAME.height };
      setCrop((c) => zoomCrop(c, c.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), anchor, size, FRAME));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [size]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    const k = FRAME.width / e.currentTarget.getBoundingClientRect().width;
    const dx = (e.clientX - drag.current.x) * k;
    const dy = (e.clientY - drag.current.y) * k;
    drag.current = { x: e.clientX, y: e.clientY };
    setCrop((c) => (size ? clampCrop({ ...c, x: c.x + dx, y: c.y + dy }, size, FRAME) : c));
  };
  const up = () => { drag.current = null; };
  const key = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) { e.preventDefault(); set({ ...crop, x: crop.x + moves[e.key][0], y: crop.y + moves[e.key][1] }); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomTo(crop.zoom * 1.1); }
    else if (e.key === "-") { e.preventDefault(); zoomTo(crop.zoom / 1.1); }
  };

  const align = (axis: "x" | "y", where: "start" | "center" | "end") => size && setCrop((c) => alignCrop(c, axis, where, size, FRAME));
  // Whether the picture is larger than the window along a direction. If not, there is nothing to align.
  const shown = size ? { width: size.width * coverScale(size, FRAME) * crop.zoom, height: size.height * coverScale(size, FRAME) * crop.zoom } : FRAME;
  const slackX = shown.width - FRAME.width > 0.5;
  const slackY = shown.height - FRAME.height > 0.5;

  const apply = async () => {
    if (!picture) return;
    setBusy(true);
    try {
      onApply(await renderCover(picture.source, crop, picture.size, FRAME, file.name));
    } catch (e) {
      onError(e instanceof ImageProblem ? e.message : "The picture could not be cropped. Try another one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="crop-title" className="w-full max-w-2xl max-h-[92vh] overflow-auto rounded-3xl bg-white p-5 sm:p-6 shadow-xl space-y-4">
        <div>
          <h2 id="crop-title" className="font-display text-lg font-bold text-slate-900">Crop and position your cover</h2>
          <p className="text-sm text-slate-600">The cover is shown wide (16:9). Drag the picture to choose what shows, and zoom to get closer.</p>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video">
          {!picture && <p className="h-full grid place-items-center text-sm text-slate-500" role="status">Opening your picture…</p>}
          <canvas
            ref={canvas} width={FRAME.width} height={FRAME.height} tabIndex={0} role="img" aria-label="Cover preview. Use the arrow keys to move the picture, plus and minus to zoom."
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
            className={`w-full h-full touch-none select-none ${picture ? "cursor-grab active:cursor-grabbing" : "hidden"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2 flex-1 min-w-[12rem]">
            <button type="button" className={SMALL_BTN} aria-label="Zoom out" disabled={!picture} onClick={() => zoomTo(crop.zoom / 1.2)}><ZoomOut className="w-4 h-4" aria-hidden="true" /></button>
            <input
              type="range" aria-label="Zoom" min={MIN_ZOOM * 100} max={MAX_ZOOM * 100} step={5} value={Math.round(crop.zoom * 100)} disabled={!picture}
              onChange={(e) => zoomTo(Number(e.target.value) / 100)} className="flex-1 accent-[hsl(var(--brand-teal))]"
            />
            <button type="button" className={SMALL_BTN} aria-label="Zoom in" disabled={!picture} onClick={() => zoomTo(crop.zoom * 1.2)}><ZoomIn className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2" role="group" aria-label="Align the picture">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 w-16">Across</span>
            <button type="button" className={SMALL_BTN} disabled={!picture || !slackX} onClick={() => align("x", "start")}><AlignLeft className="w-4 h-4" aria-hidden="true" />Left</button>
            <button type="button" className={SMALL_BTN} disabled={!picture || !slackX} onClick={() => align("x", "center")}><AlignCenter className="w-4 h-4" aria-hidden="true" />Centre</button>
            <button type="button" className={SMALL_BTN} disabled={!picture || !slackX} onClick={() => align("x", "end")}><AlignRight className="w-4 h-4" aria-hidden="true" />Right</button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 w-16">Up / down</span>
            <button type="button" className={SMALL_BTN} disabled={!picture || !slackY} onClick={() => align("y", "start")}><ArrowUpToLine className="w-4 h-4" aria-hidden="true" />Top</button>
            <button type="button" className={SMALL_BTN} disabled={!picture || !slackY} onClick={() => align("y", "center")}><ChevronsUpDown className="w-4 h-4" aria-hidden="true" />Middle</button>
            <button type="button" className={SMALL_BTN} disabled={!picture || !slackY} onClick={() => align("y", "end")}><ArrowDownToLine className="w-4 h-4" aria-hidden="true" />Bottom</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button type="button" className="text-sm font-semibold text-slate-500 hover:text-brand-teal underline-offset-2 hover:underline" disabled={!picture || busy} onClick={onSkip}>Use the whole picture, no crop</button>
          <div className="flex gap-2">
            <button type="button" className={secondaryBtn} onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="button" className={primaryBtn} onClick={() => void apply()} disabled={!picture || busy}>{busy ? "Getting it ready…" : "Use this crop"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
