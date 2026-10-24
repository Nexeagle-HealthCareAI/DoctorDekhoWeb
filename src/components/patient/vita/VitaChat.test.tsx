import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import replies from "./vitaReplies.fixture.json";

// Replies captured from the real router (1HMS-NLP-Router /v2/agent/chat) running against its fake 1HMS:
// see vitaReplies.fixture.json. Every test drives the panel as a patient would and checks both what is
// shown and what is sent to /api/vita/chat.

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (p: { src: string; alt: string; "data-mood"?: string }) => <img src={p.src} alt={p.alt} data-mood={p["data-mood"]} />,
}));
vi.mock("@/lib/navigation", () => ({ geocodeAddress: vi.fn(async () => [88.41, 22.58]) }));

import VitaChat from "./VitaChat";
import { I18nProvider } from "@/lib/i18n/I18nContext";
import { useVitaChat } from "@/hooks/useVitaChat";
import { __resetLocationStore, getLocation, setLocation, useSharedLocation } from "@/lib/location/store";

function Harness() {
  const chat = useVitaChat();
  return <VitaChat chat={chat} onClose={() => {}} />;
}

type Reply = (typeof replies)[keyof typeof replies];
const sent: Record<string, unknown>[] = [];
let queue: (Reply | { status: number })[] = [];

beforeEach(() => {
  sent.length = 0;
  queue = [];
  window.sessionStorage.clear();
  window.localStorage.clear();
  __resetLocationStore();
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body ?? "{}")));
    const next = queue.shift();
    if (next && "status" in next && !("kind" in next)) return new Response("{}", { status: next.status });
    return new Response(JSON.stringify(next ?? {}), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const show = () => render(<I18nProvider><Harness /></I18nProvider>);

async function say(text: string, reply: Reply | { status: number }) {
  queue.push(reply);
  const box = screen.getByRole("textbox", { name: /message to vita/i });
  await userEvent.type(box, text);
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
}

describe("Vita chat panel", () => {
  it("UI-1: greets and offers the five ways to ask", () => {
    show();
    expect(screen.getByRole("heading", { name: /I'm Vita/ })).toBeInTheDocument();
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
    expect(getLocation()).toMatchObject({ city: { name: "Salt Lake" }, source: "picked", coords: { lat: 22.58, lng: 88.41 } });
  });

  it("LOC: the detected location is sent by default, without asking", async () => {
    setLocation({ city: { id: "kolkata-west-bengal", name: "Kolkata", state: "West Bengal" }, coords: { lat: 22.57, lng: 88.36 } }, "detected");
    show();
    expect(screen.getByText(/Kolkata/)).toBeInTheDocument();
    await say("paas mein cardiologist", replies.list);
    expect(sent.at(-1)).toMatchObject({ city: "Kolkata", lat: 22.57, lng: 88.36 });
  });

  it("LOC: a city picked on the site shows in the chat, and one typed in the chat shows on the site", async () => {
    function Site() {
      const loc = useSharedLocation();
      return (
        <div>
          <p data-testid="site-city">{loc.city?.name ?? "none"}</p>
          <button type="button" onClick={() => setLocation({ city: { id: "purnea-bihar", name: "Purnea", state: "Bihar" } }, "picked")}>pick Purnea</button>
        </div>
      );
    }
    render(<I18nProvider><Site /><Harness /></I18nProvider>);
    await userEvent.click(screen.getByRole("button", { name: "pick Purnea" }));
    expect(screen.getByTestId("site-city")).toHaveTextContent("Purnea");
    expect(screen.getByText(/Purnea/, { selector: "span" })).toBeInTheDocument(); // the chat's location line
    await say("paas mein cardiologist", replies.list);
    expect(sent.at(-1)).toMatchObject({ city: "Purnea" });
    expect(sent.at(-1)).not.toHaveProperty("lat");

    await say("paas mein cardiologist", replies.location);
    await userEvent.click(await screen.findByRole("button", { name: "Type area or pincode" }));
    queue.push(replies.list);
    const box = screen.getByRole("textbox", { name: /your city or area/i });
    await userEvent.clear(box);
    await userEvent.type(box, "Kishanganj");
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    expect(screen.getByTestId("site-city")).toHaveTextContent("Kishanganj");
  });

  it("LANG: the site's language goes with each message, so Vita's first guess matches the screen", async () => {
    function HindiHarness() {
      const chat = useVitaChat({ uiLanguage: "hi" });
      return <VitaChat chat={chat} onClose={() => {}} />;
    }
    render(<I18nProvider><HindiHarness /></I18nProvider>);
    await say("Dr Anita Sen", replies.list);
    expect(sent.at(-1)).toMatchObject({ text: "Dr Anita Sen", ui_language: "hi" });
  });

  it("UI-6: an emergency shows the emergency card and nothing to book", async () => {
    show();
    await say("seene mein tez dard aur saans nahi aa rahi", replies.emergency);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This may be a medical emergency");
    expect(alert).toHaveTextContent("Chest pain");
    expect(alert).toHaveTextContent("Breathlessness");
    expect(alert).not.toHaveTextContent("listed below"); // no doctor list follows in the chat
    const calls = within(alert).getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(calls).toEqual(["tel:108", "tel:112", "tel:102"]); // 108 (ambulance) first, then 112 and 102
    expect(screen.queryByRole("button", { name: /^Choose/ })).not.toBeInTheDocument();
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

  it("moods: the header pose and words follow what Vita is doing", async () => {
    const { container } = show();
    const header = () => container.querySelector("header")!;
    expect(header()).toHaveTextContent("here to help");
    expect(header().querySelector("[data-mood]")).toHaveAttribute("data-mood", "welcome");

    // a slow search: thinking first, then the working card
    let release: (r: Response) => void = () => {};
    (fetch as unknown as { mockImplementationOnce: (f: unknown) => void }).mockImplementationOnce(
      (_u: string, init?: RequestInit) => {
        sent.push(JSON.parse(String(init?.body ?? "{}")));
        return new Promise<Response>((res) => { release = res; });
      });
    await userEvent.type(screen.getByRole("textbox", { name: /message to vita/i }), "lady skin doctor");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(header()).toHaveTextContent("Thinking about what you said");
    expect(await screen.findByText("Looking for the right doctors…", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(header().querySelector("[data-mood]")).toHaveAttribute("data-mood", "working");
    release(new Response(JSON.stringify(replies.list), { status: 200, headers: { "content-type": "application/json" } }));
    expect(await screen.findByText("Dr. Anita Sen")).toBeInTheDocument();
    expect(screen.queryByText("Looking for the right doctors…")).not.toBeInTheDocument();
  });

  it("moods: choosing a doctor brings the joyful eagle", async () => {
    show();
    await say("lady skin doctor", replies.list);
    queue.push(replies.selected);
    await userEvent.click(await screen.findByRole("button", { name: "Choose Dr. Anita Sen" }));
    await screen.findByRole("link", { name: /Book a slot/ });
    expect(document.querySelector('[data-mood="joyful"]')).not.toBeNull();
  });

  it("moods: an emergency turns the header red and shows no eagle at all", async () => {
    const { container } = show();
    await say("seene mein tez dard aur saans nahi aa rahi", replies.emergency);
    await screen.findByRole("alert");
    const header = container.querySelector("header")!;
    expect(header).toHaveTextContent("This may be an emergency");
    expect(header.className).toContain("bg-[#B3141E]");
    const lastEntry = screen.getByRole("alert").parentElement!;
    expect(lastEntry.querySelector("[data-mood]")).toBeNull();
    expect(header.querySelector("[data-mood]")).toBeNull();
  });

  it("voice: the mic shows only where the browser can listen, and fills the box", async () => {
    show();
    expect(screen.queryByRole("button", { name: "Speak your message" })).not.toBeInTheDocument();
  });
});
