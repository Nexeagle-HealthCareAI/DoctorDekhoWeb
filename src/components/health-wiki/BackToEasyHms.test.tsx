import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));

import BackToEasyHms from "./BackToEasyHms";

const setHistory = (length: number) => Object.defineProperty(window.history, "length", { value: length, configurable: true });

beforeEach(() => { search.value = ""; setHistory(3); });

describe("BackToEasyHms", () => {
  it("shows a way back for a doctor who came from the Health Wiki in EasyHMS, and steps back in the browser history", async () => {
    search.value = "from=1hms";
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(<BackToEasyHms />);
    await userEvent.click(await screen.findByRole("button", { name: /Back to EasyHMS/ }));
    expect(back).toHaveBeenCalledOnce();
  });

  it("shows nothing for an ordinary reader", () => {
    render(<BackToEasyHms />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows nothing when there is nowhere to go back to, such as a link opened in a new tab", () => {
    search.value = "from=1hms";
    setHistory(1);
    render(<BackToEasyHms />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("ignores any other value, and never takes an address from the link", () => {
    search.value = "from=https://evil.example";
    render(<BackToEasyHms />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
