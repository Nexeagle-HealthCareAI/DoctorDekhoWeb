import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const api = vi.hoisted(() => ({ articleHistory: vi.fn() }));
vi.mock("@/lib/contributor/client", () => ({ contributorApi: api, ApiError: class extends Error {} }));

import ArticleHistory from "./ArticleHistory";

beforeEach(() => vi.clearAllMocks());

describe("ArticleHistory", () => {
  it("shows each step with who did it, and the team's reason where there is one", async () => {
    api.articleHistory.mockResolvedValue([
      { at: "2026-10-26T10:00:00Z", kind: "PUT_BACK_LIVE", action: "Put back live", actor: "NexEagle team", byMe: false, detail: "Sources were added." },
      { at: "2026-10-25T10:00:00Z", kind: "PULLED_BACK", action: "Pulled back to review", actor: "NexEagle team", byMe: false, detail: "Please name the sources." },
      { at: "2026-10-20T10:00:00Z", kind: "SELF_PUBLISHED", action: "Published, no review needed", actor: "Dr. Meera", byMe: true, detail: null },
    ]);
    render(<ArticleHistory slug="bp" />);

    expect(await screen.findByText("Put back live")).toBeInTheDocument();
    expect(screen.getByText("Please name the sources.")).toBeInTheDocument();
    expect(screen.getByText("Sources were added.")).toBeInTheDocument();
    expect(screen.getByText(/^You ·/)).toBeInTheDocument();
    expect(screen.getAllByText(/^NexEagle team ·/)).toHaveLength(2);
    expect(api.articleHistory).toHaveBeenCalledWith("bp");
  });

  it("says so when there is nothing yet", async () => {
    api.articleHistory.mockResolvedValue([]);
    render(<ArticleHistory slug="bp" />);
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
  });

  it("offers a retry when the history cannot be loaded", async () => {
    api.articleHistory.mockRejectedValue(new Error("No connection."));
    render(<ArticleHistory slug="bp" />);
    expect(await screen.findByText(/No connection\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
