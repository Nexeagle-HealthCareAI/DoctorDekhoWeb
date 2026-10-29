// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fetchMock = vi.fn();

async function load(env: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.stubGlobal("fetch", fetchMock);
  return { stt: await import("./transcribe/route"), tts: await import("./speak/route") };
}

function audioForm(type = "audio/webm", bytes = 2000, locale = "hinglish") {
  const f = new FormData();
  f.append("audio", new Blob([new Uint8Array(bytes)], { type }), "turn");
  f.append("locale", locale);
  return f;
}
const transcribeReq = (form: FormData, ip = "1.2.3.4") =>
  new NextRequest("http://dd.test/api/voice/transcribe", { method: "POST", body: form, headers: { "x-forwarded-for": ip } });
const speakReq = (body: unknown) =>
  new NextRequest("http://dd.test/api/voice/speak", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
});

describe("/api/voice/transcribe", () => {
  it("is off without a Groq key", async () => {
    const { stt } = await load({ GROQ_API_KEY: "" });
    expect(await (await stt.GET()).json()).toEqual({ enabled: false });
    expect((await stt.POST(transcribeReq(audioForm()))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the turn to Groq Whisper in Hindi for a Hinglish speaker, with the key only on the server", async () => {
    const { stt } = await load({ GROQ_API_KEY: "gsk_test\n" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: " मुझे बुखार है " }), { status: 200 }));
    const res = await stt.POST(transcribeReq(audioForm()));
    expect(await res.json()).toEqual({ success: true, text: "मुझे बुखार है" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(init.headers.Authorization).toBe("Bearer gsk_test");
    const sent = init.body as FormData;
    expect(sent.get("model")).toBe("whisper-large-v3-turbo");
    expect(sent.get("language")).toBe("hi");
    expect((sent.get("file") as File).name).toBe("turn.webm");
  });

  it("English and Bengali speakers, and Safari's mp4", async () => {
    const { stt } = await load({ GROQ_API_KEY: "k" });
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ text: "fever" }), { status: 200 }));
    await stt.POST(transcribeReq(audioForm("audio/mp4", 100, "en")));
    await stt.POST(transcribeReq(audioForm("audio/webm", 100, "bn")));
    const forms = fetchMock.mock.calls.map((c) => c[1].body as FormData);
    expect(forms[0].get("language")).toBe("en");
    expect((forms[0].get("file") as File).name).toBe("turn.m4a");
    expect(forms[1].get("language")).toBe("bn");
  });

  it("drops Whisper's stock words on silence", async () => {
    const { stt } = await load({ GROQ_API_KEY: "k" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: "Thank you for watching" }), { status: 200 }));
    expect(await (await stt.POST(transcribeReq(audioForm()))).json()).toEqual({ success: true, text: "" });
  });

  it("refuses what is not audio, too long, and too many", async () => {
    const { stt } = await load({ GROQ_API_KEY: "k" });
    expect((await stt.POST(transcribeReq(audioForm("text/plain")))).status).toBe(415);
    expect((await stt.POST(transcribeReq(audioForm("audio/webm", 5 * 1024 * 1024)))).status).toBe(413);
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ text: "x" }), { status: 200 }));
    let last = 200;
    for (let i = 0; i < 41; i++) last = (await stt.POST(transcribeReq(audioForm(), "9.9.9.9"))).status;
    expect(last).toBe(429);
  });

  it("a Groq failure is a 502, not a crash", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { stt } = await load({ GROQ_API_KEY: "k" });
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    expect((await stt.POST(transcribeReq(audioForm()))).status).toBe(502);
  });
});

describe("/api/voice/speak", () => {
  it("speaks English with Groq Orpheus", async () => {
    const { tts } = await load({ GROQ_API_KEY: "k" });
    expect(await (await tts.GET()).json()).toEqual({ languages: ["english"] });
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([82, 73, 70, 70]), { status: 200, headers: { "content-type": "audio/wav" } }));
    const res = await tts.POST(speakReq({ text: "Booked for tomorrow morning.", language: "english" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ model: "canopylabs/orpheus-v1-english", voice: "diana", input: "Booked for tomorrow morning.", response_format: "wav" });
  });

  it("leaves Hindi and Hinglish to the browser (204), and any Groq failure too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { tts } = await load({ GROQ_API_KEY: "k" });
    expect((await tts.POST(speakReq({ text: "Kal subah aaiye.", language: "hinglish" }))).status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response("x", { status: 400 }));
    expect((await tts.POST(speakReq({ text: "Hello.", language: "english" }))).status).toBe(204);
  });

  it("refuses more than one sentence-sized piece", async () => {
    const { tts } = await load({ GROQ_API_KEY: "k" });
    expect((await tts.POST(speakReq({ text: "x".repeat(201), language: "english" }))).status).toBe(400);
  });

  it("Hinglish too when configured", async () => {
    const { tts } = await load({ GROQ_API_KEY: "k", GROQ_TTS_LANGUAGES: "english,hinglish", GROQ_TTS_VOICE: "hannah" });
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1]), { status: 200 }));
    expect((await tts.POST(speakReq({ text: "Kal subah aaiye.", language: "hinglish" }))).status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).voice).toBe("hannah");
  });
});
