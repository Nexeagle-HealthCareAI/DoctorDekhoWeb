import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import replies from "./vitaVisit.fixture.json";

// After booking in the chat (vision Phase 4): "I've reached" gets the steps and a "Check in now" button; the location goes to Vita
// with "check in", and the token comes back. The device's latest booking is sent so Vita knows which visit. Real router replies.

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

const sent: Record<string, unknown>[] = [];
let queue: unknown[] = [];
const BOOKING = replies.arrival.visit.appointmentId;

function Harness() {
  const chat = useVitaChat();
  return <VitaChat chat={chat} onClose={() => {}} />;
}

beforeEach(() => {
  sent.length = 0;
  queue = [];
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.localStorage.setItem("nexeagle_guest_appointments", JSON.stringify({ version: 1, entries: [
    { appointmentId: BOOKING, mobile: "9876543210", bookedAt: new Date().toISOString() }] }));
  __resetLocationStore();
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 22.58, longitude: 88.42, accuracy: 15 } } as GeolocationPosition) } });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    sent.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(JSON.stringify(queue.shift() ?? {}), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("after booking in the chat", () => {
  it("answers I've reached with the steps, checks in with the location and shows the token", async () => {
    render(<I18nProvider><Harness /></I18nProvider>);
    queue.push(replies.arrival);
    await userEvent.type(screen.getByRole("textbox"), "I've reached");
    await userEvent.click(screen.getByRole("button", { name: /^send/i }));
    const card = await screen.findByRole("region", { name: "Visit details" });
    expect(sent[0]).toMatchObject({ text: "I've reached", visit_appointment_id: BOOKING });
    expect(screen.getByText(/Counter 3, ground floor/)).toBeTruthy();
    expect(within(card).getByRole("link", { name: /directions/i }).getAttribute("href")).toContain("destination=22.58,88.42");
    expect(within(card).getByRole("link", { name: "Visit details" }).getAttribute("href")).toBe(`/appointments/visit/${BOOKING}`);

    queue.push(replies.checked_in);
    await userEvent.click(within(card).getByRole("button", { name: "Check in now" }));
    expect(sent.at(-1)).toMatchObject({ text: "check in", lat: 22.58, lng: 88.42 });
    const after = (await screen.findAllByRole("region", { name: "Visit details" })).at(-1)!;
    expect(within(after).getByText("7")).toBeTruthy();
    expect(within(after).getByText("About 25 min to go")).toBeTruthy();
    expect(within(after).queryByRole("button", { name: "Check in now" })).toBeNull();
  });
});
