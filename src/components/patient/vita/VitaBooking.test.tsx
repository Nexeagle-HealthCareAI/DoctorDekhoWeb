import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import replies from "./vitaBooking.fixture.json";

// Booking inside the chat (vision Phase 2). Replies are the real router's, recorded against a fake 1HMS
// (1HMS-NLP-Router tests/test_vita_booking.py): day -> who -> name -> age -> sex -> mobile -> code -> confirm -> booked.

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

function Harness() {
  const chat = useVitaChat();
  return <VitaChat chat={chat} onClose={() => {}} />;
}

beforeEach(() => {
  sent.length = 0;
  queue = [];
  window.sessionStorage.clear();
  window.localStorage.clear();
  __resetLocationStore();
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    sent.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(JSON.stringify(queue.shift() ?? {}), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const show = () => render(<I18nProvider><Harness /></I18nProvider>);
const input = () => screen.getByRole("textbox");

async function type(text: string, reply: object) {
  queue.push(reply);
  await userEvent.type(input(), text);
  await userEvent.click(screen.getByRole("button", { name: /^send/i }));
  await screen.findByText((reply as { message: string }).message, undefined, { timeout: 2000 });
}

async function tap(label: string, reply: object) {
  queue.push(reply);
  const buttons = screen.getAllByRole("button", { name: label });
  await userEvent.click(buttons[buttons.length - 1]);
  await screen.findByText((reply as { message: string }).message, undefined, { timeout: 2000 });
}

describe("booking in the chat", () => {
  it("walks a guest from choosing a doctor to a booking, with the right keyboard at each step", async () => {
    show();
    await type("skin ka doctor chahiye", replies.selected);
    // Vita books here: the day chips, not the separate "Book a slot" page
    expect(screen.queryByRole("link", { name: /book a slot/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Kal (Mon 26 Oct)" })).toBeTruthy();

    await tap("Kal (Mon 26 Oct)", replies.who);
    await tap("Mere liye", replies.name);
    expect(input().getAttribute("autocomplete")).toBe("name");
    await type("Rina Kumari", replies.age);
    expect(input().getAttribute("inputmode")).toBe("numeric");
    await type("32", replies.sex);
    await tap("Mahila", replies.mobile);
    expect(input().getAttribute("type")).toBe("tel");
    expect(input().getAttribute("autocomplete")).toBe("tel-national");

    await type("9876543210", replies.otp);
    expect(input().getAttribute("autocomplete")).toBe("one-time-code");
    expect(input().getAttribute("maxlength")).toBe("6");

    await type("123456", replies.confirm);
    // the code is sent to Vita but never shown back or kept on this device
    expect(sent.at(-1)).toMatchObject({ text: "123456" });
    expect(screen.queryByText("123456")).toBeNull();
    expect(window.localStorage.getItem("vita_chat") ?? "").not.toContain("123456");

    const summary = screen.getByRole("region", { name: "Check before I book" });
    expect(within(summary).getByText("Rina Kumari (32, F)")).toBeTruthy();
    expect(within(summary).getByText("98xxxxxx10")).toBeTruthy();
    expect(within(summary).getByText("₹600, paid at the hospital")).toBeTruthy();

    await tap("Haan, book karo", replies.booked);
    const booked = screen.getByRole("region", { name: "Booked" });
    expect(within(booked).getByText("Booking ID: ABCDEF12")).toBeTruthy();
    expect(within(booked).getByRole("link", { name: /directions/i }).getAttribute("href")).toContain("destination=22.58,88.41");
    expect(within(booked).getByRole("link", { name: "My appointments" }).getAttribute("href")).toBe("/appointments");

    // listed under this device's "My appointments", with the number the patient typed
    const saved = JSON.parse(window.localStorage.getItem("nexeagle_guest_appointments") ?? "{}");
    expect(saved.entries).toEqual([expect.objectContaining({ appointmentId: replies.booked.booking.appointmentId, mobile: "9876543210" })]);
  });

  it("keeps booking answers out of recent searches", async () => {
    show();
    await type("skin ka doctor chahiye", replies.selected);
    await tap("Kal (Mon 26 Oct)", replies.who);
    await tap("Mere liye", replies.name);
    await type("Rina Kumari", replies.age);
    const recent = window.localStorage.getItem("vita_recent") ?? "";
    expect(recent).toContain("skin ka doctor chahiye");
    expect(recent).not.toContain("Rina");
  });
});
