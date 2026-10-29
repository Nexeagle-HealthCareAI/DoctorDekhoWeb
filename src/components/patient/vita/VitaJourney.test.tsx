import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import replies from "./vitaJourney.fixture.json";

// "nikal raha hoon" after booking: Vita answers with the in-app navigation and, for a cab, Uber / Ola with the clinic filled in.
// The navigation opens for the booking, so it can tell reception the time left (the patient agreed). A real router reply.

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
const opened: unknown[] = [];
vi.mock("@/components/navigation/NavigationProvider", () => ({
  useNavigation: () => ({ openNavigation: (d: unknown) => opened.push(d) }),
}));

import VitaChat from "./VitaChat";
import { I18nProvider } from "@/lib/i18n/I18nContext";
import { useVitaChat } from "@/hooks/useVitaChat";
import { __resetLocationStore } from "@/lib/location/store";

let queue: unknown[] = [];
const BOOKING = replies.navigate.visit.appointmentId;

function Harness() {
  const chat = useVitaChat();
  return <VitaChat chat={chat} onClose={() => {}} />;
}

beforeEach(() => {
  queue = [];
  opened.length = 0;
  window.sessionStorage.clear();
  window.localStorage.clear();
  __resetLocationStore();
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify(queue.shift() ?? {}), { status: 200, headers: { "content-type": "application/json" } })));
});
afterEach(() => vi.unstubAllGlobals());

describe("on the way to the clinic", () => {
  it("shows navigation and cab buttons, and opens the navigation for the booking", async () => {
    render(<I18nProvider><Harness /></I18nProvider>);
    queue.push(replies.navigate);
    await userEvent.type(screen.getByRole("textbox"), "nikal raha hoon");
    await userEvent.click(screen.getByRole("button", { name: /^send/i }));
    const card = await screen.findByRole("region", { name: "Visit details" });
    expect(within(card).getByText("About 59 min")).toBeTruthy();
    expect(within(card).getByRole("link", { name: /uber/i }).getAttribute("href")).toContain("m.uber.com/ul/?action=setPickup");
    expect(within(card).getByRole("link", { name: /ola/i }).getAttribute("href")).toContain("drop_lat=22.58&drop_lng=88.42");
    expect(within(card).queryByRole("link", { name: /directions/i })).toBeNull();
    await userEvent.click(within(card).getByRole("button", { name: /start navigation/i }));
    expect(opened[0]).toMatchObject({ name: "Salt Lake Care", latitude: 22.58, longitude: 88.42, profile: "driving", appointmentId: BOOKING });
  });
});
