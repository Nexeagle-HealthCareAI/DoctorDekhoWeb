import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import replies from "./vitaEmergency.fixture.json";

// Emergency takeover in the chat (vision Phase 3): 108 / 112 stay on top; under them the nearest emergency hospitals the router
// got from 1HMS, with call buttons (logged) and directions; no location -> share it and the hospitals follow; the patient's number
// goes to the hospitals only with consent. Replies are the real router's (1HMS-NLP-Router tests/test_vita_emergency.py).

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("@/lib/navigation", () => ({ geocodeAddress: vi.fn(async () => null) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

import VitaChat from "./VitaChat";
import { I18nProvider } from "@/lib/i18n/I18nContext";
import { useVitaChat } from "@/hooks/useVitaChat";
import { __resetLocationStore } from "@/lib/location/store";

const calls: { url: string; body: Record<string, unknown> }[] = [];
let queue: unknown[] = [];
let emergencyStatus = 200;

function Harness() {
  const chat = useVitaChat();
  return <VitaChat chat={chat} onClose={() => {}} />;
}

beforeEach(() => {
  calls.length = 0;
  queue = [];
  emergencyStatus = 200;
  window.sessionStorage.clear();
  window.localStorage.clear();
  __resetLocationStore();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ url, body });
    if (url.startsWith("/api/vita/emergency/")) return new Response(JSON.stringify({ ok: emergencyStatus === 200 }), { status: emergencyStatus });
    return new Response(JSON.stringify(queue.shift() ?? {}), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const show = () => render(<I18nProvider><Harness /></I18nProvider>);

async function type(text: string, reply: object) {
  queue.push(reply);
  await userEvent.type(screen.getByRole("textbox"), text);
  await userEvent.click(screen.getByRole("button", { name: /^send/i }));
}

describe("emergency takeover in the chat", () => {
  it("shows the nearest hospitals under 108/112, with call buttons that are logged", async () => {
    show();
    await type("I have severe chest pain and can't breathe", replies.guest);
    const list = await screen.findByRole("region", { name: "Nearest emergency hospitals" });
    expect(screen.getByRole("alert").textContent).toMatch(/108/);                     // the banner stays first
    const items = within(list).getAllByRole("listitem");
    expect(items.map((i) => within(i).getByText(/^(Salt Lake Care|District Hospital)$/).textContent))
      .toEqual(["Salt Lake Care", "District Hospital"]);
    expect(within(items[0]).getByText("1.2 km")).toBeTruthy();
    const call = within(items[0]).getByRole("link", { name: "Call Salt Lake Care on 03340001111" });
    expect(call.getAttribute("href")).toBe("tel:03340001111");
    expect(within(items[0]).getByRole("link", { name: /directions/i }).getAttribute("href")).toContain("destination=22.58,88.42");
    expect(within(list).getByText("We've told them a patient may be coming.")).toBeTruthy();

    call.addEventListener("click", (e) => e.preventDefault());                          // jsdom cannot dial
    await userEvent.click(call);
    expect(calls.at(-1)).toEqual({
      url: `/api/vita/emergency/${replies.guest.emergency.eventId}`,
      body: { action: "call", settingId: replies.guest.emergency.places[0].settingId },
    });
  });

  it("shares the number only after the consent box is ticked", async () => {
    show();
    await type("I have severe chest pain and can't breathe", replies.guest);
    const form = await screen.findByRole("form", { name: "Want the hospital to call you?" });
    expect(within(form).queryByRole("textbox")).toBeNull();                              // nothing to type before consent
    await userEvent.click(within(form).getByRole("checkbox", { name: "Share my number so the hospital can call me" }));
    await userEvent.type(within(form).getByRole("textbox", { name: "Your mobile number" }), "98765 43210");
    await userEvent.click(within(form).getByRole("button", { name: "Share" }));
    expect(calls.at(-1)).toEqual({
      url: `/api/vita/emergency/${replies.guest.emergency.eventId}`,
      body: { action: "share", mobile: "98765 43210", consent: true },
    });
    expect(await screen.findByText(/The hospitals have your number/)).toBeTruthy();
  });

  it("says so when the number could not be sent", async () => {
    emergencyStatus = 502;
    show();
    await type("I have severe chest pain and can't breathe", replies.guest);
    const form = await screen.findByRole("form", { name: "Want the hospital to call you?" });
    await userEvent.click(within(form).getByRole("checkbox"));
    await userEvent.type(within(form).getByRole("textbox"), "9876543210");
    await userEvent.click(within(form).getByRole("button", { name: "Share" }));
    expect(await screen.findByText(/Couldn't send your number/)).toBeTruthy();
  });

  it("asks for the location and sends it, then the hospitals follow", async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 22.57, longitude: 88.41, accuracy: 20 } } as GeolocationPosition));
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    show();
    await type("I have severe chest pain and can't breathe", replies.nolocation);
    await screen.findByText("Share your location to see the nearest emergency hospitals.");
    queue.push(replies.located);
    await userEvent.click(screen.getAllByRole("button", { name: /share my location/i }).at(-1)!);
    await screen.findByRole("region", { name: "Nearest emergency hospitals" });
    const sent = calls.filter((c) => c.url === "/api/vita/chat").at(-1)!.body;
    expect(sent).toMatchObject({ text: "location", lat: 22.57, lng: 88.41, session_id: replies.nolocation.session_id });
  });

  it("a signed-in patient shares with the router's one-tap chip instead of typing", async () => {
    show();
    await type("I have severe chest pain and can't breathe", replies.signed);
    await screen.findByRole("region", { name: "Nearest emergency hospitals" });
    expect(screen.queryByRole("form", { name: "Want the hospital to call you?" })).toBeNull();
    queue.push(replies.shared);
    await userEvent.click(screen.getByRole("button", { name: "Share my number" }));
    expect(calls.filter((c) => c.url === "/api/vita/chat").at(-1)!.body).toMatchObject({ text: "Share my number" });
    expect(await screen.findByText(replies.shared.message)).toBeTruthy();
  });
});
