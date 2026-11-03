// "Hey Vita" in the browser: the microphone -> 16 kHz frames (public/wakeword/worklet.js) -> WakeCore -> WakeDetector. Everything
// runs on the device; no audio leaves it. onnxruntime-web is loaded from /ort/ (copied there at build) only when a patient turns
// the wake word on, so the site's own JavaScript stays small.
import { FRAME, WakeCore, WakeDetector, loadModels, type Ort } from "./core";

const BASE = "/wakeword";

export interface WakeConfig {
  model: string;
  threshold: number;
  patience: number;
  cooldownMs: number;
}

export function wakeWordSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof WebAssembly === "object" && typeof AudioWorkletNode !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

let ortPromise: Promise<Ort> | null = null;
function loadOrt(): Promise<Ort> {
  const url = "/ort/ort.wasm.min.mjs";
  ortPromise ??= (import(/* webpackIgnore: true */ url) as Promise<Ort>).then((ort) => {
    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.wasm.numThreads = 1;              // threads need cross-origin isolation, which this site does not have
    return ort;
  });
  return ortPromise;
}

let ready: Promise<{ ort: Ort; models: Awaited<ReturnType<typeof loadModels>>; config: WakeConfig }> | null = null;
function loadAll() {
  ready ??= (async () => {
    const config = (await (await fetch(`${BASE}/hey_vita.json`, { cache: "no-cache" })).json()) as WakeConfig;
    const ort = await loadOrt();
    const models = await loadModels(ort, {
      mel: `${BASE}/melspectrogram.onnx`,
      embedding: `${BASE}/embedding_model.onnx`,
      wake: `${BASE}/${config.model}`,
    });
    return { ort, models, config };
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

/** Start loading the models ahead of time (e.g. when the patient opens the settings). */
export function preloadWakeWord() {
  void loadAll().catch(() => {});
}

export type WakeState = "starting" | "listening" | "blocked" | "error";

export class WakeWordEngine {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private stopped = false;
  private resumeOnTap: (() => void) | null = null;

  /** The last 2 s of audio, for the second check (src/lib/wakeword/verify.ts). */
  private recent = new Float32Array(32000);

  constructor(private handlers: { onWake: (audio: Float32Array) => void; onState: (s: WakeState) => void; onScore?: (score: number) => void }) {}

  async start() {
    this.stopped = false;
    this.handlers.onState("starting");
    try {
      const { ort, models, config } = await loadAll();
      if (this.stopped) return;
      const core = new WakeCore(ort, models);
      const detector = new WakeDetector({ threshold: config.threshold, patience: config.patience, cooldownMs: config.cooldownMs });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      if (this.stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const ctx = this.openContext(stream);
      this.ctx = ctx.context;
      await this.ctx.audioWorklet.addModule(`${BASE}/worklet.js`);
      if (this.stopped) return this.stop();
      const node = new AudioWorkletNode(this.ctx, "wake-word-frames");
      this.node = node;
      let pending = 0;
      node.port.onmessage = (e: MessageEvent<Float32Array>) => {
        if (this.stopped || e.data.length !== FRAME) return;
        this.recent.copyWithin(0, FRAME);
        this.recent.set(e.data, this.recent.length - FRAME);
        if (pending > 4) return;                       // a slow device drops frames instead of falling behind
        pending++;
        void core.push(e.data).then((score) => {
          pending--;
          if (this.stopped || score === null) return;
          this.handlers.onScore?.(score);
          if (detector.step(score, performance.now())) this.handlers.onWake(this.recent.slice());
        }, () => { pending--; });
      };
      ctx.source.connect(node);
      // the worklet must be pulled by the graph; a muted gain keeps it running without playing the microphone back
      const mute = this.ctx.createGain();
      mute.gain.value = 0;
      node.connect(mute).connect(this.ctx.destination);
      if (this.ctx.state === "suspended") {
        this.handlers.onState("blocked");               // the browser wants a tap first
        this.resumeOnTap = () => {
          void this.ctx?.resume().then(() => { if (!this.stopped) this.handlers.onState("listening"); });
          this.clearTap();
        };
        window.addEventListener("pointerdown", this.resumeOnTap, { once: true });
        window.addEventListener("keydown", this.resumeOnTap, { once: true });
      } else {
        this.handlers.onState("listening");
      }
    } catch (err) {
      console.warn("[wake word] off:", (err as Error)?.name ?? err);
      this.stop();
      this.handlers.onState("error");
    }
  }

  private openContext(stream: MediaStream): { context: AudioContext; source: MediaStreamAudioSourceNode } {
    try {
      const context = new AudioContext({ sampleRate: 16000 });
      return { context, source: context.createMediaStreamSource(stream) };
    } catch {
      const context = new AudioContext();                 // Firefox: the device rate; the worklet resamples
      return { context, source: context.createMediaStreamSource(stream) };
    }
  }

  private clearTap() {
    if (!this.resumeOnTap) return;
    window.removeEventListener("pointerdown", this.resumeOnTap);
    window.removeEventListener("keydown", this.resumeOnTap);
    this.resumeOnTap = null;
  }

  stop() {
    this.stopped = true;
    this.clearTap();
    if (this.node) {
      this.node.port.onmessage = null;
      this.node.disconnect();
      this.node = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
