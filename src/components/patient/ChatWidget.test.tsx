import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import replies from "./vita/vitaReplies.fixture.json";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("@/hooks/usePatientAuth", () => ({ usePatientAuth: () => ({ isLoggedIn: false }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

import ChatWidget from "./ChatWidget";
import { I18nProvider } from "@/lib/i18n/I18nContext";

let enabled = true;
const answers: unknown[] = [];

beforeEach(() => {
  enabled = true;
  answers.length = 0;
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init || init.method !== "POST") return new Response(JSON.stringify({ enabled }), { status: 200 });
    return new Response(JSON.stringify(answers.shift() ?? {}), { status: 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const show = () => render(<I18nProvider><ChatWidget /></I18nProvider>);
const launcherImg = () => screen.getByRole("button", { name: "Ask Vita" }).querySelector("img");

describe("chat widget launcher", () => {
  it("is always the resting eagle with Ask Vita, from the first paint", () => {
    show();
    expect(launcherImg()).toHaveAttribute("src", "/vita/resting.png");
    expect(screen.queryByRole("button", { name: /whatsapp/i })).not.toBeInTheDocument();
  });

  it("stays Vita even when the router is not ready: a getting-ready note with WhatsApp inside", async () => {
    enabled = false;
    show();
    await new Promise((r) => setTimeout(r, 1000));
    expect(launcherImg()).toHaveAttribute("src", "/vita/resting.png");
    await userEvent.click(screen.getByRole("button", { name: "Ask Vita" }));
    expect(await screen.findByText("Vita is getting ready")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue on WhatsApp/ })).toHaveAttribute("href", expect.stringContaining("wa.me"));
  });

  it("flies in once on a first visit with one line, and not again", async () => {
    const first = show();
    expect(await screen.findByText(/Need a doctor\? Ask me/, {}, { timeout: 5000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hide this message" }));
    expect(window.localStorage.getItem("vita_seen")).toBe("1");
    first.unmount();
    show();
    await waitFor(() => expect(launcherImg()).not.toBeNull(), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 3500));
    expect(screen.queryByText(/Need a doctor\? Ask me/)).not.toBeInTheDocument();
  }, 15000);

  it("keeps the conversation when closed, and sleeps after goodbye", async () => {
    window.localStorage.setItem("vita_seen", "1");
    show();
    await waitFor(() => expect(launcherImg()).not.toBeNull(), { timeout: 3000 });
    await userEvent.click(screen.getByRole("button", { name: "Ask Vita" }));
    answers.push({ ...replies.handoff, kind: "info", message: "No problem. I'm here whenever you need a doctor." });
    await userEvent.type(screen.getByRole("textbox", { name: /message to vita/i }), "bas dekh raha tha");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/No problem/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Close chat" })[0]);
    await waitFor(() => expect(launcherImg()).toHaveAttribute("src", "/vita/sleeping.png"), { timeout: 3000 });
    await userEvent.click(screen.getByRole("button", { name: "Ask Vita" }));
    expect(await screen.findByText(/No problem/)).toBeInTheDocument(); // the conversation is still there
  });

  it("checks again on open, so a router fixed meanwhile turns the chat on", async () => {
    enabled = false;
    show();
    await new Promise((r) => setTimeout(r, 1000));
    enabled = true;
    await userEvent.click(screen.getByRole("button", { name: "Ask Vita" }));
    expect(await screen.findByRole("textbox", { name: /message to vita/i })).toBeInTheDocument();
  });
});
