import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/contribute", tab: null as string | null }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.tab ? `tab=${nav.tab}` : ""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
const api = vi.hoisted(() => ({ me: vi.fn(), articles: vi.fn() }));
vi.mock("@/lib/contributor/client", () => ({ contributorApi: api }));

import ContributorShell from "./ContributorShell";

const doctor = { id: "c1", role: "INDEPENDENT_DOCTOR", fullName: "Dr. Asha Rao", mobileMasked: "+91 98••• ••210", status: "VERIFIED" };
const writer = { ...doctor, role: "WRITER", fullName: "Rohan Mehta", status: "PENDING" };
const lists = { pending: [{}, {}], published: [{}, {}, {}], drafts: [{}] };

beforeEach(() => {
  vi.clearAllMocks();
  nav.pathname = "/contribute";
  nav.tab = null;
  api.me.mockResolvedValue(doctor);
  api.articles.mockResolvedValue(lists);
});

const renderShell = () => render(<ContributorShell><p>screen</p></ContributorShell>);
const item = (name: RegExp) => screen.getByRole("link", { name });

describe("Contributor area menu", () => {
  it("shows the person and their work, with counts, beside the screen", async () => {
    renderShell();
    expect(await screen.findByText("Dr. Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("Health Wiki contributor")).toBeInTheDocument();
    expect(screen.getByText(/Independent doctor · Verified/)).toBeInTheDocument();
    expect(item(/Write an article/)).toHaveAttribute("href", "/contribute/write");
    expect(item(/My drafts/)).toHaveTextContent("1");
    expect(item(/Published/)).toHaveTextContent("3");
    expect(item(/Pending at you/)).toHaveTextContent("2");
    expect(item(/Topic requests/)).toHaveAttribute("href", "/contribute/topics");
    expect(screen.getByText("screen")).toBeInTheDocument();
  });

  it("highlights where the person is", async () => {
    nav.tab = "drafts";
    renderShell();
    await screen.findByText("Dr. Asha Rao");
    expect(item(/My drafts/)).toHaveAttribute("aria-current", "page");
    expect(item(/Published/)).not.toHaveAttribute("aria-current");
  });

  it("opens a doctor on 'Pending at you' by default, a writer on 'Published', and a writer has no 'Pending at you'", async () => {
    renderShell();
    await screen.findByText("Dr. Asha Rao");
    expect(item(/Pending at you/)).toHaveAttribute("aria-current", "page");

    api.me.mockResolvedValue(writer);
    renderShell();
    await screen.findAllByText("Rohan Mehta");
    expect(screen.getAllByRole("link", { name: /Published/ }).at(-1)).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: /Pending at you/ })).toHaveLength(1); // only the doctor's menu
  });

  it("marks a draft being edited as My drafts, and a review as Pending at you", async () => {
    nav.pathname = "/contribute/write/my-draft";
    renderShell();
    await screen.findByText("Dr. Asha Rao");
    expect(item(/My drafts/)).toHaveAttribute("aria-current", "page");
    expect(item(/Write an article/)).not.toHaveAttribute("aria-current");
  });

  it("has no menu on the sign-in, join and finish-your-profile screens", async () => {
    for (const path of ["/contribute/login", "/contribute/join", "/contribute/register", "/contribute/sso", "/contribute/invite/abc"]) {
      nav.pathname = path;
      const { unmount } = renderShell();
      expect(screen.getByText("screen")).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Your work" })).toBeNull();
      unmount();
    }
    expect(api.me).not.toHaveBeenCalled();
  });

  it("has no menu for someone who has not finished their profile", async () => {
    api.me.mockResolvedValue({ ...doctor, status: "INVITED" });
    renderShell();
    await screen.findByText("screen");
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("navigation", { name: "Your work" })).toBeNull();
  });
});
