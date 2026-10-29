import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { LiveTurn } from "@/hooks/useLiveVoice";
import type { VitaEntry } from "@/hooks/useVitaChat";

// The hands-free loop, with the microphone and the voice faked: listen -> send -> speak the reply -> listen again.

const turns: LiveTurn[] = [];
const said: string[] = [];
const listen = vi.fn(async (): Promise<LiveTurn> => turns.shift() ?? { kind: "cancelled" });
const mic = { phase: "ready", level: 0, open: vi.fn(async () => true), listen, cancel: vi.fn(), close: vi.fn() };
const voice = { prime: vi.fn(), speak: vi.fn(async (text: string) => { said.push(text); }), stop: vi.fn(), speaking: false };
vi.mock("@/hooks/useLiveVoice", () => ({ useLiveVoice: () => mic, liveVoiceSupported: () => true }));
vi.mock("@/hooks/useVoicePlayer", () => ({ useVoicePlayer: () => voice }));

import { useVitaLive } from "./useVitaLive";

const t = (k: string) => k;
const vita = (id: number, message: string, extra: Record<string, unknown> = {}) =>
  ({ id, role: "vita", reply: { session_id: "s", turn: id, kind: "follow_up", message, language: "hinglish", ...extra } }) as unknown as VitaEntry;

beforeEach(() => {
  turns.length = 0;
  said.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ enabled: true }), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

function setup(entries: VitaEntry[] = []) {
  const send = vi.fn();
  const hook = renderHook((p: { entries: VitaEntry[]; busy: boolean }) =>
    useVitaLive({ entries: p.entries, busy: p.busy, locale: "hinglish", send, t: t as never }), { initialProps: { entries, busy: false } });
  return { send, ...hook };
}

describe("talking with Vita", () => {
  it("is offered when the server has voice", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.available).toBe(true));
  });

  it("sends what was said, speaks the reply, and listens again", async () => {
    turns.push({ kind: "text", text: "mujhe bukhar hai" });
    const old = vita(1, "Namaste");
    const { result, rerender, send } = setup([old]);
    await act(() => result.current.start());
    expect(voice.prime).toHaveBeenCalled();
    await waitFor(() => expect(send).toHaveBeenCalledWith("mujhe bukhar hai"));
    expect(said).toEqual([]);                                             // what was on screen is not re-read
    turns.push({ kind: "text", text: "3 din se" });
    rerender({ entries: [old, { id: 2, role: "user" } as VitaEntry], busy: true });
    rerender({ entries: [old, { id: 2, role: "user" } as VitaEntry, vita(3, "Kab se hai bukhar?")], busy: false });
    await waitFor(() => expect(send).toHaveBeenCalledWith("3 din se"));
    expect(said).toEqual(["Kab se hai bukhar?"]);
  });

  it("stops after an emergency reply, once it is said", async () => {
    turns.push({ kind: "text", text: "seene mein dard" });
    const { result, rerender } = setup();
    await act(() => result.current.start());
    rerender({ entries: [vita(2, "Turant 112 par call karein", { kind: "emergency" })], busy: false });
    await waitFor(() => expect(result.current.on).toBe(false));
    expect(said).toEqual(["Turant 112 par call karein"]);
    expect(result.current.notice).toBe("vita.liveEmergency");
    expect(mic.close).toHaveBeenCalled();
  });

  it("waits for typing at the mobile number and WhatsApp code", async () => {
    turns.push({ kind: "text", text: "book karo" });
    const { result, rerender } = setup();
    await act(() => result.current.start());
    listen.mockClear();
    rerender({ entries: [vita(2, "Aapka mobile number?", { clarify: { kind: "book_mobile", question: "", options: [] } })], busy: false });
    await waitFor(() => expect(result.current.notice).toBe("vita.liveType"));
    expect(listen).not.toHaveBeenCalled();
    expect(result.current.on).toBe(true);
  });

  it("pauses when nobody speaks, and says why", async () => {
    turns.push({ kind: "no_speech" });
    const { result } = setup();
    await act(() => result.current.start());
    await waitFor(() => expect(result.current.on).toBe(false));
    expect(result.current.notice).toBe("vita.livePaused");
  });

  it("asks again once when no words came through", async () => {
    turns.push({ kind: "text", text: "" }, { kind: "text", text: "haan" });
    const { result, send } = setup();
    await act(() => result.current.start());
    await waitFor(() => expect(send).toHaveBeenCalledWith("haan"));
    expect(said).toEqual(["vita.liveMissed"]);
  });

  it("without the microphone it explains", async () => {
    mic.open.mockResolvedValueOnce(false);
    const { result } = setup();
    await act(() => result.current.start());
    expect(result.current.on).toBe(false);
    expect(result.current.notice).toBe("vita.liveMicDenied");
  });
});
