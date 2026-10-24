import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const flag = vi.hoisted(() => ({ on: true }));
vi.mock("@/lib/contributor/session", () => ({ get CONTRIBUTOR_ENABLED() { return flag.on; } }));

import JoinCallout from "./JoinCallout";

describe("JoinCallout", () => {
  it("offers the join link in the banner form", () => {
    flag.on = true;
    render(<JoinCallout />);
    expect(screen.getByRole("link", { name: "Join as a contributor" })).toHaveAttribute("href", "/contribute/join");
    expect(screen.getByRole("heading", { name: "Write for the Health Wiki" })).toBeInTheDocument();
  });

  it("offers the same link in the sidebar form, stacked for a narrow column", () => {
    flag.on = true;
    const { container } = render(<JoinCallout variant="sidebar" />);
    expect(screen.getByRole("link", { name: "Join as a contributor" })).toHaveAttribute("href", "/contribute/join");
    // stacked card: no full-width row layout and no big top margin like the banner
    expect(container.querySelector("section")?.className).toContain("flex-col");
    expect(container.querySelector("section")?.className).not.toContain("mt-12");
  });

  it("shows nothing while the contributor area is switched off", () => {
    flag.on = false;
    const { container } = render(<JoinCallout variant="sidebar" />);
    expect(container).toBeEmptyDOMElement();
  });
});
