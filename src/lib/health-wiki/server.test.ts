import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
const api = vi.hoisted(() => ({ easyhmsFetch: vi.fn(), easyhmsFetchRevalidating: vi.fn(), isConfigured: vi.fn(() => true) }));
vi.mock("@/lib/api/server", () => api);
vi.mock("./interim", () => ({ getInterimArticles: async () => [] }));

import { getPublishedArticle } from "./server";

const dto = (id: string) => ({ id, type: "MEDICAL", title: "Fresh article", content: "## Hello", publishedAt: "2026-10-27T10:00:00Z" });

beforeEach(() => {
  vi.clearAllMocks();
  api.isConfigured.mockReturnValue(true);
});

describe("getPublishedArticle", () => {
  it("finds an article that is in the list", async () => {
    api.easyhmsFetch.mockResolvedValueOnce({ ok: true, status: 200, data: { articles: [dto("in-list")] } });
    expect((await getPublishedArticle("in-list"))?.slug).toBe("in-list");
    expect(api.easyhmsFetch).toHaveBeenCalledTimes(1);
  });

  it("asks the backend for an article published after the list was cached, instead of answering 404", async () => {
    api.easyhmsFetch.mockResolvedValueOnce({ ok: true, status: 200, data: { articles: [dto("old-one")] } });
    api.easyhmsFetchRevalidating.mockResolvedValueOnce({ ok: true, status: 200, data: dto("just-published") });
    expect((await getPublishedArticle("just-published"))?.title).toBe("Fresh article");
    expect(api.easyhmsFetchRevalidating).toHaveBeenCalledWith("/public/health-articles/just-published", expect.objectContaining({ revalidate: 60 }));
  });

  it("is still not found when the backend does not have it either", async () => {
    api.easyhmsFetch.mockResolvedValueOnce({ ok: true, status: 200, data: { articles: [] } });
    api.easyhmsFetchRevalidating.mockResolvedValueOnce({ ok: false, status: 404, data: null });
    expect(await getPublishedArticle("nothing-here")).toBeNull();
  });

  it("treats a backend failure as not found, and does not throw", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    api.easyhmsFetch.mockResolvedValueOnce({ ok: true, status: 200, data: { articles: [] } });
    api.easyhmsFetchRevalidating.mockResolvedValueOnce({ ok: false, status: 502, data: null });
    expect(await getPublishedArticle("some-article")).toBeNull();
    log.mockRestore();
  });

  it("does not ask the backend about something that is not a slug", async () => {
    api.easyhmsFetch.mockResolvedValueOnce({ ok: true, status: 200, data: { articles: [] } });
    expect(await getPublishedArticle("../../admin")).toBeNull();
    expect(api.easyhmsFetchRevalidating).not.toHaveBeenCalled();
  });
});
