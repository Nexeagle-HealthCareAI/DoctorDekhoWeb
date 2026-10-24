import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import replies from "./vitaReplies.fixture.json";

// Replies captured from the real router (1HMS-NLP-Router /v2/agent/chat) running against its fake 1HMS:
// see vitaReplies.fixture.json. Every test drives the panel as a patient would and checks both what is
// shown and what is sent to /api/vita/chat.

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("@/lib/navigation", () => ({ geocodeAddress: vi.fn(async () => [88.41, 22.58]) }));

import VitaChat from "./VitaChat";
import { I18nProvider } from "@/lib/i18n/I18nContext";

type Reply = (typeof replies)[keyof typeof replies];
const sent: Record<string, unknown>[] = [];
let queue: (Reply | { status: number })[] = [];

beforeEach(() => {
  sent.length = 0;
  queue = [];
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body ?? "{}")));
    const next = queue.shift();
    if (next && "status" in next && !("kind" in next)) return new Response("{}", { status: next.status });
    return new Response(JSON.stringify(next ?? {}), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const show = () => render(<I18nProvider><VitaChat /></I18nProvider>);

async function say(text: string, reply: Reply | { status: number }) {
  queue.push(reply);
  const box = screen.getByRole("textbox", { name: /message to vita/i });
  await userEvent.type(box, text);
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
}

describe("Vita chat panel", () => {
  it("UI-1: greets and offers the five ways to ask", () => {
    show();
    expect(screen.getByText(/I'm Vita/)).toBeInTheDocument();
    for (const name of ["Describe a symptom", "Choose a specialty", "Doctor's name", "By degree", "Doctors near me"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("UI-1: a specialty shortcut sends plain words the router reads", async () => {
    show();
    queue.push(replies.list);
    await userEvent.click(screen.getByRole("button", { name: "Choose a specialty" }));
    await userEvent.click(screen.getByRole("button", { name: "Skin" }));
    expect(sent[0]).toMatchObject({ text: "skin ka doctor" });
  });

  it("UI-3: shows the doctor cards and the applied filters", async () => {
    show();
    await say("lady skin doctor", replies.list);
    expect(await screen.findByText("Dr. Anita Sen")).toBeInTheDocument();
    expect(screen.getByText("Dr. Priya Bose")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Choose Dr\./ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Remove filter: Lady doctor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove filter: Dermatologist" })).toBeInTheDocument();
  });

  it("UI-3: removing a filter re-searches without it", async () => {
    show();
    await say("lady skin doctor", replies.list);
    queue.push(replies.list);
    await userEvent.click(await screen.findByRole("button", { name: "Remove filter: Lady doctor" }));
    expect(sent.at(-1)).toMatchObject({ text: "Dermatologist", new_search: true, session_id: replies.list.session_id });
  });

  it("UI-5: choosing a doctor sends its id and shows Book a slot", async () => {
    show();
    await say("lady skin doctor", replies.list);
    queue.push(replies.selected);
    await userEvent.click(await screen.findByRole("button", { name: "Choose Dr. Anita Sen" }));
    expect(sent.at(-1)).toMatchObject({ select_doctor_id: replies.list.doctors!.items[0].doctorId, session_id: replies.list.session_id });
    const book = await screen.findByRole("link", { name: /Book a slot/ });
    expect(book.getAttribute("href")).toMatch(/^\/doctors\/.+--00000000-0000-0000-0000-000000000003#book$/);
  });

  it("UI-3: Show more doctors asks for the next page", async () => {
    show();
    await say("cardiologist", replies.more);
    queue.push(replies.more);
    await userEvent.click(await screen.findByRole("button", { name: "Show more doctors" }));
    expect(sent.at(-1)).toMatchObject({ page: 2 });
  });

  it("UI-4: the location question offers three ways, and the browser is asked only after a tap", async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 22.58, longitude: 88.4 } } as GeolocationPosition));
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
    show();
    await say("paas mein cardiologist", replies.location);
    expect(await screen.findByRole("button", { name: "Share my location" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type area or pincode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use my city" })).toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    queue.push(replies.list);
    await userEvent.click(screen.getByRole("button", { name: "Share my location" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(sent.at(-1)).toMatchObject({ lat: 22.58, lng: 88.4, session_id: replies.location.session_id });
  });

  it("UI-4: a typed area becomes a point and the city is remembered", async () => {
    show();
    await say("paas mein cardiologist", replies.location);
    await userEvent.click(await screen.findByRole("button", { name: "Type area or pincode" }));
    queue.push(replies.list);
    await userEvent.type(screen.getByRole("textbox", { name: /your city or area/i }), "Salt Lake");
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    expect(sent.at(-1)).toMatchObject({ text: "Salt Lake", city: "Salt Lake", lat: 22.58, lng: 88.41 });
    expect(window.localStorage.getItem("vita_city")).toBe("Salt Lake");
  });

  it("UI-6: an emergency shows the emergency card and nothing to book", async () => {
    show();
    await say("seene mein tez dard aur saans nahi aa rahi", replies.emergency);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This may be a medical emergency");
    expect(alert).toHaveTextContent("Chest pain");
    expect(alert).toHaveTextContent("Breathlessness");
    expect(alert).not.toHaveTextContent("listed below"); // no doctor list follows in the chat
    expect(within(alert).getByRole("link")).toHaveAttribute("href", "tel:108");
    expect(screen.queryByRole("button", { name: /^Choose/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/112/)).not.toBeInTheDocument(); // one emergency number on screen
  });

  it("VITA-4: two doctors with one name are told apart, and tapping one chooses it", async () => {
    show();
    await say("dr sharma", replies.which);
    queue.push(replies.selected);
    await userEvent.click(await screen.findByRole("button", { name: "Dr. Rakesh Sharma · Howrah General, Kolkata" }));
    expect(sent.at(-1)).toMatchObject({ select_doctor_id: "00000000-0000-0000-0000-000000000002" });
  });

  it("availability: shows working days and the book offer", async () => {
    show();
    await say("is Dr Neha Sharma available Monday?", replies.availability);
    expect(await screen.findByText("Working days")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, book" })).toBeInTheDocument();
    queue.push(replies.selected);
    await userEvent.click(screen.getByRole("button", { name: "Yes, book" }));
    expect(sent.at(-1)).toMatchObject({ select_doctor_id: "00000000-0000-0000-0000-000000000001" });
  });

  it("UI-7: 1HMS down shows a short message, Retry and the directory", async () => {
    show();
    await say("skin ka doctor", replies.degraded);
    expect(await screen.findByText("Vita can't reach the doctor list right now.")).toBeInTheDocument();
    queue.push(replies.list);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(sent.at(-1)).toMatchObject({ text: "skin ka doctor" });
    expect(screen.getAllByRole("link", { name: "Browse all doctors" }).length).toBeGreaterThan(0);
  });

  it("the router being down never leaves the patient stuck", async () => {
    show();
    await say("skin ka doctor", { status: 502 });
    expect(await screen.findByText("Vita can't reach the doctor list right now.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("a handoff offers WhatsApp", async () => {
    show();
    await say("mujhe kisi insaan se baat karni hai", replies.handoff);
    expect(await screen.findByRole("link", { name: /Continue on WhatsApp/ })).toHaveAttribute("href", expect.stringContaining("wa.me"));
  });

  it("UI-8: new messages are announced to screen readers", () => {
    show();
    expect(screen.getByRole("log")).toHaveAttribute("aria-live", "polite");
  });
});
