import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import replies from "./vitaReplies.fixture.json";

// The chat window's flexibility features: menu (new chat, language, text size, read aloud), one-tap
// narrowing, start over, suggestions while typing, the pinned doctor, 24 h memory, recent searches,
// card actions and feedback. Replies come from the real router (vitaReplies.fixture.json).

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("@/lib/navigation", () => ({ geocodeAddress: vi.fn(async () => null) }));
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ trackEvent: (...a: unknown[]) => track(...a) }));

import VitaChat from "./VitaChat";
import { I18nProvider } from "@/lib/i18n/I18nContext";
import { useVitaChat } from "@/hooks/useVitaChat";
import { __resetLocationStore } from "@/lib/location/store";
import { addRecent } from "@/lib/vita/memory";
import { refineOptions, refinePhrase, suggest } from "@/lib/vita/refine";
import type { VitaDoctorsBlock } from "@/lib/vita/types";

type Reply = (typeof replies)[keyof typeof replies];
const sent: Record<string, unknown>[] = [];
const methods: string[] = [];
let queue: unknown[] = [];

function Harness() {
  const chat = useVitaChat();
  return <VitaChat chat={chat} onClose={() => {}} onToggleExpand={() => {}} />;
}

beforeEach(() => {
  sent.length = 0;
  methods.length = 0;
  queue = [];
  track.mockClear();
  window.sessionStorage.clear();
  window.localStorage.clear();
  __resetLocationStore();
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    methods.push(init?.method ?? "GET");
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    sent.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(JSON.stringify(queue.shift() ?? {}), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const show = () => render(<I18nProvider><Harness /></I18nProvider>);

async function say(text: string, reply: Reply | object) {
  queue.push(reply);
  await userEvent.type(screen.getByRole("textbox", { name: /message to vita/i }), text);
  await userEvent.click(screen.getByRole("button", { name: /^send/i }));
  await screen.findAllByText((reply as Reply).message ?? "", undefined, { timeout: 2000 }).catch(() => null);
}

describe("one-tap narrowing", () => {
  it("offers only what would change the list, and sends it in the conversation's language", async () => {
    show();
    await say("lady skin doctor", replies.list);
    const group = await screen.findByRole("group", { name: "Narrow these down" });
    const labels = within(group).getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["Lower fee", "Available today", "Nearest", "Most experienced"]);   // already lady doctors
    queue.push(replies.list);
    await userEvent.click(within(group).getByRole("button", { name: "Lower fee" }));
    expect(sent.at(-1)).toMatchObject({ text: "lowest fee among these", session_id: replies.list.session_id });
  });

  it("phrases each refinement in English, Hinglish or Hindi", () => {
    expect(refinePhrase("female", "english")).toBe("lady doctor among these");
    expect(refinePhrase("female", "hinglish")).toBe("inme se koi lady doctor");
    expect(refinePhrase("female", "hindi")).toBe("इनमें से कोई महिला डॉक्टर");
    const block = { filters: { sort: "fee", availableToday: true, location: "shared" } } as unknown as VitaDoctorsBlock;
    expect(refineOptions(block)).toEqual(["female", "experience"]);
  });
});

describe("suggestions while typing", () => {
  it("suggests a specialty and searches for it in one tap", async () => {
    show();
    await userEvent.type(screen.getByRole("textbox", { name: /message to vita/i }), "skin");
    const group = await screen.findByRole("group", { name: "Suggestions" });
    queue.push(replies.list);
    await userEvent.click(within(group).getByRole("button", { name: "Skin doctor (Dermatologist)" }));
    expect(sent.at(-1)).toMatchObject({ text: "dermatologist" });
    expect(screen.getByRole("textbox", { name: /message to vita/i })).toHaveValue("");
  });

  it("matches Hindi and Hinglish words too", () => {
    expect(suggest("dil")[0].send).toBe("cardiologist");
    expect(suggest("हड्डी")[0].send).toBe("orthopaedic");
    expect(suggest("a")).toEqual([]);
  });
});

describe("menu", () => {
  it("New chat forgets the conversation here and asks the router to forget it", async () => {
    show();
    await say("lady skin doctor", replies.list);
    await userEvent.click(screen.getByRole("button", { name: "Chat options" }));
    await userEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.getByRole("heading", { name: /I'm Vita/ })).toBeInTheDocument();
    expect(methods).toContain("DELETE");
    expect(window.localStorage.getItem("vita_chat")).toBeNull();
  });

  it("text size makes the conversation bigger and is remembered", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Chat options" }));
    await userEvent.click(screen.getByRole("button", { name: "Larger" }));
    const log = screen.getByRole("log");
    expect((log.firstElementChild as HTMLElement).style.zoom).toBe("1.3");
    expect(JSON.parse(window.localStorage.getItem("vita_prefs") ?? "{}")).toMatchObject({ textSize: "larger" });
  });

  it("switching language changes the chat's own words", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Chat options" }));
    await userEvent.click(screen.getByRole("button", { name: "हिंदी" }));
    expect(screen.getByRole("button", { name: "नई बातचीत" }).textContent).toBeTruthy();
  });
});

describe("memory", () => {
  it("brings back today's conversation after the tab was closed", async () => {
    const first = show();
    await say("lady skin doctor", replies.list);
    first.unmount();
    show();
    expect(await screen.findByText(/Earlier conversation/)).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Dr. Anita Sen" })).toBeInTheDocument();
  });

  it("forgets a conversation older than 24 hours", () => {
    window.localStorage.setItem("vita_chat", JSON.stringify({ savedAt: Date.now() - 25 * 3600_000, sessionId: null,
      entries: [{ id: 1, role: "user", text: "old" }] }));
    show();
    expect(screen.queryByText("old")).toBeNull();
    expect(window.localStorage.getItem("vita_chat")).toBeNull();
  });

  it("shows recent searches on the home screen", async () => {
    addRecent("skin doctor in Purnea");
    show();
    queue.push(replies.list);
    await userEvent.click(await screen.findByRole("button", { name: "skin doctor in Purnea" }));
    expect(sent.at(-1)).toMatchObject({ text: "skin doctor in Purnea" });
  });
});

describe("doctor cards and the chosen doctor", () => {
  it("each card offers directions and share; call only with a front desk number", async () => {
    show();
    await say("lady skin doctor", replies.list);
    const card = screen.getByRole("article", { name: "Dr. Anita Sen" });
    expect(within(card).getByRole("link", { name: /Directions/ }).getAttribute("href")).toContain("destination=22.58,88.41");
    expect(within(card).getByRole("button", { name: /Share/ })).toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: /Call hospital/ })).toBeNull();
  });

  it("pins the chosen doctor once the conversation moves on", async () => {
    show();
    await say("lady skin doctor", replies.list);
    queue.push(replies.selected);
    await userEvent.click(await screen.findByRole("button", { name: "Choose Dr. Anita Sen" }));
    await screen.findByText("Your doctor");
    expect(screen.getAllByRole("link", { name: /Book a slot/ })).toHaveLength(1);
    await say("is she available tomorrow?", replies.availability);
    // the earlier selection card stays in the history, and the pinned bar keeps Book a slot at the top
    expect(screen.getAllByRole("link", { name: /Book a slot/ })).toHaveLength(2);
  });
});

describe("start over and feedback", () => {
  it("a dead end offers Start over", async () => {
    show();
    const noMatch = { ...replies.which, kind: "doctor_list", message: "I couldn't find a doctor named 'zzyzx'.",
      doctors: undefined, clarify: { kind: "no_match", question: null, options: [] } };
    await say("dr zzyzx", noMatch);
    await userEvent.click(await screen.findByRole("button", { name: "Start over" }));
    expect(screen.getByRole("heading", { name: /I'm Vita/ })).toBeInTheDocument();
  });

  it("thumbs on the latest reply are recorded once", async () => {
    show();
    await say("lady skin doctor", replies.list);
    await userEvent.click(screen.getByRole("button", { name: "Helpful" }));
    expect(track).toHaveBeenCalledWith("vita_feedback", expect.objectContaining({
      metadata: expect.objectContaining({ helpful: true, kind: "doctor_list", sessionId: replies.list.session_id }) }));
    expect(screen.getByText("Thanks for telling us")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Helpful" })).toBeNull();
  });
});
