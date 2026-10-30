import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

// "Hey Vita" from the widget: listens only when the patient turned it on, shows that it is listening, opens the chat when heard.
// The engine is faked; the real one is checked against the training pipeline in src/lib/wakeword/core.test.ts.

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("@/hooks/usePatientAuth", () => ({ usePatientAuth: () => ({ isLoggedIn: false }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/voice/chime", () => ({ chime: vi.fn() }));
const wake = { active: false, onWake: () => {} };
vi.mock("@/hooks/useWakeWord", () => ({
  useWakeWord: (p: { active: boolean; onWake: () => void }) => {
    wake.active = p.active;
    wake.onWake = p.onWake;
    return { status: p.active ? "listening" : "off", score: 0, supported: true };
  },
}));

import ChatWidget from "./ChatWidget";
import { I18nProvider } from "@/lib/i18n/I18nContext";
import { chime } from "@/lib/voice/chime";

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("vita_seen", "1");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ enabled: true }), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

const show = () => render(<I18nProvider><ChatWidget /></I18nProvider>);

describe("Hey Vita", () => {
  it("is off unless the patient turned it on", () => {
    show();
    expect(wake.active).toBe(false);
    expect(screen.getByRole("button", { name: "Ask Vita" })).toBeInTheDocument();
  });

  it("when on: says it is listening, and opens Vita with a chime when heard", async () => {
    window.localStorage.setItem("vita_prefs", JSON.stringify({ textSize: "normal", readAloud: false, wakeWord: true }));
    show();
    expect(await screen.findByRole("button", { name: /Listening for “Hey Vita”/ })).toBeInTheDocument();
    expect(wake.active).toBe(true);
    act(() => wake.onWake());
    expect(chime).toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
