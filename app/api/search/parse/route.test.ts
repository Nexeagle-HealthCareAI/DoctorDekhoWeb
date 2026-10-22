// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Real responses from the current router (1HMS-NLP-Router develop, 2026-10-21), trimmed.
const ROUTER = {
  answer: {
    decision: "answer", decisive: true, noMatch: false, matchScore: 1.0, confidence: 0.631,
    specialties: [{ specialtyId: "gastroenterology", name: "Gastroenterology", confidence: 0.631 }],
    specialtyIds: ["gastroenterology"],
    emergency: { flag: false, reasons: [], source: null, score: 0.08, recommendedSpecialtyIds: [] },
    clarify: null, reason: "Aapke shabd 'pet', 'dard' Gastroenterology ke milte-julte cases se match karte hain.",
    method: "deterministic", usedDefault: false, modelVersion: "2026-10-21-124832",
  },
  clarifyAge: {
    decision: "clarify", decisive: false, noMatch: false, confidence: 0.5503,
    specialtyIds: ["pediatrics", "general", "ent", "orthopedics", "generalsurgery"],
    emergency: { flag: false, reasons: [], source: null, score: 0.03, recommendedSpecialtyIds: [] },
    clarify: { kind: "age", question: "Yeh bachche ke liye hai ya bade ke liye?", options: ["Bachcha", "Bada"], optionIds: ["child", "adult"] },
    reason: null, method: "deterministic", usedDefault: false, modelVersion: "m",
  },
  clarifySpecialty: {
    decision: "clarify", decisive: false, noMatch: false, confidence: 0.41,
    specialtyIds: ["neurology", "general", "ent", "psychiatry", "ophthalmology"],
    emergency: { flag: false, reasons: [], source: null, score: 0.02, recommendedSpecialtyIds: [] },
    clarify: { kind: "specialty", question: "Inmein se kaunsa aapki takleef se zyada milta hai?", options: ["Neurology", "General Physician", "ENT"], optionIds: ["neurology", "general", "ent"] },
    reason: null, method: "deterministic", usedDefault: false, modelVersion: "m",
  },
  emergency: {
    decision: "clarify", decisive: false, noMatch: false, confidence: 0.5566,
    specialtyIds: ["emergencymedicine", "pulmonology", "cardiology", "ent", "sportsmedicine"],
    emergency: { flag: true, reasons: ["Chest pain", "Breathlessness"], source: "rules+model", score: 0.9946, recommendedSpecialtyIds: ["emergencymedicine", "cardiology", "pulmonology"] },
    clarify: { kind: "specialty", question: "Inmein se kaunsa?", options: ["Emergency Medicine", "Pulmonology"], optionIds: ["emergencymedicine", "pulmonology"] },
    reason: null, method: "deterministic", usedDefault: false, modelVersion: "m",
  },
  abstain: {
    decision: "abstain", decisive: false, noMatch: true, matchScore: 0.29, confidence: null,
    specialties: [], specialtyIds: [],
    emergency: { flag: false, reasons: [], source: null, score: 0.0079, recommendedSpecialtyIds: [] },
    clarify: null, reason: "I could not match this to a specialty. A General Physician can assess it first.",
    method: null, usedDefault: false, modelVersion: "m",
  },
  legacyDecisive: { specialtyIds: ["dermatology"], usedDefault: false, method: "tfidf", confidence: 0.8, modelVersion: "old" },
  legacyHedge: { specialtyIds: ["neurology", "general", "ent", "psychiatry", "ophthalmology"], usedDefault: false, method: "tfidf", confidence: 0.3, modelVersion: "old" },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const groqSays = (content: unknown) => json({ choices: [{ message: { content: JSON.stringify(content) } }] });

const fetchMock = vi.fn();
let POST: (req: NextRequest) => Promise<Response>;

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  ({ POST } = await import("./route"));
}

const ask = async (body: unknown) => {
  const res = await POST(new NextRequest("http://localhost/api/search/parse", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

const routerCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("router.test"));
const groqCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("groq.com"));

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await load({ NLP_ROUTER_BASE_URL: "http://router.test", NLP_ROUTER_API_KEY: "k", GROQ_API_KEY: "g" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("search parse: current router", () => {
  it("emergency comes first: Emergency Medicine + reasons, never sent to Groq", async () => {
    fetchMock.mockResolvedValueOnce(json(ROUTER.emergency));
    const { body } = await ask({ query: "seene mein tez dard aur saans nahi aa rahi" });
    expect(body.emergency).toEqual({ reasons: ["Chest pain", "Breathlessness"], source: "router" });
    expect(body.specialtyId).toBe("emergencymedicine");
    expect(body.specialtyIds).toEqual(["emergencymedicine", "cardiology", "pulmonology"]);
    expect(body.clarify).toBeNull();
    expect(groqCalls()).toHaveLength(0);
  });

  it("answer: uses the router's specialties", async () => {
    fetchMock.mockResolvedValueOnce(json(ROUTER.answer));
    const { body } = await ask({ query: "pet mein dard" });
    expect(body.specialtyIds).toEqual(["gastroenterology"]);
    expect(body.decision).toBe("answer");
    expect(body.emergency).toBeNull();
    expect(body.method).toBe("deterministic");
    expect(groqCalls()).toHaveLength(0);
  });

  it("clarify (age): passes the question through, keeps the hedge list, no Groq", async () => {
    fetchMock.mockResolvedValueOnce(json(ROUTER.clarifyAge));
    const { body } = await ask({ query: "2 din se bukhar aur gale mein dard hai" });
    expect(body.clarify).toEqual({
      kind: "age",
      question: "Yeh bachche ke liye hai ya bade ke liye?",
      options: [{ id: "child", label: "Bachcha" }, { id: "adult", label: "Bada" }],
    });
    expect(body.specialtyIds[0]).toBe("pediatrics");
    expect(groqCalls()).toHaveLength(0);
  });

  it("forwards the patient's age answer to the router as context.ageGroup", async () => {
    fetchMock.mockResolvedValueOnce(json(ROUTER.answer));
    await ask({ query: "2 din se bukhar", ageGroup: "child" });
    const sent = JSON.parse(routerCalls()[0][1].body);
    expect(sent).toEqual({ query: "2 din se bukhar", context: { ageGroup: "child" } });
  });

  it("ignores an unknown ageGroup", async () => {
    fetchMock.mockResolvedValueOnce(json(ROUTER.answer));
    await ask({ query: "bukhar", ageGroup: "teen" });
    expect(JSON.parse(routerCalls()[0][1].body)).toEqual({ query: "bukhar" });
  });

  it("clarify (specialty): Groq picks, and the router's options ride along", async () => {
    fetchMock
      .mockResolvedValueOnce(json(ROUTER.clarifySpecialty))
      .mockResolvedValueOnce(groqSays({ specialtyId: "neurology", city: null, keywords: ["sir", "dard"], emergency: false, emergencyReasons: [] }));
    const { body } = await ask({ query: "sir mein dard aur chakkar" });
    expect(body.specialtyIds).toEqual(["neurology"]);
    expect(body.clarify.kind).toBe("specialty");
    expect(body.clarify.options.map((o: { id: string }) => o.id)).toEqual(["neurology", "general", "ent"]);
    expect(groqCalls()).toHaveLength(1);
  });

  it("clarify (specialty) with Groq down: the router's hedge list", async () => {
    fetchMock.mockResolvedValueOnce(json(ROUTER.clarifySpecialty)).mockResolvedValueOnce(json({ error: "rate limited" }, 429));
    const { status, body } = await ask({ query: "sir mein dard aur chakkar" });
    expect(status).toBe(200);
    expect(body.specialtyIds).toEqual(ROUTER.clarifySpecialty.specialtyIds);
    expect(body.clarify.kind).toBe("specialty");
  });

  it("Groq's emergency opinion is ignored when the router answered", async () => {
    fetchMock
      .mockResolvedValueOnce(json(ROUTER.clarifySpecialty))
      .mockResolvedValueOnce(groqSays({ specialtyId: "neurology", city: null, keywords: [], emergency: true, emergencyReasons: ["x"] }));
    const { body } = await ask({ query: "sir mein dard" });
    expect(body.emergency).toBeNull();
  });

  it("abstain: suggests a General Physician with the router's reason", async () => {
    fetchMock.mockResolvedValueOnce(json(ROUTER.abstain));
    const { body } = await ask({ query: "hello kaise ho" });
    expect(body.specialtyIds).toEqual(["general"]);
    expect(body.decision).toBe("abstain");
    expect(body.reason).toContain("General Physician");
    expect(groqCalls()).toHaveLength(0);
  });
});

describe("search parse: safetyOnly (keyword search already found doctors)", () => {
  it("returns the emergency when the router flags one", async () => {
    fetchMock.mockResolvedValueOnce(json(ROUTER.emergency));
    const { body } = await ask({ query: "chest pain and sweating", safetyOnly: true });
    expect(body.emergency).toEqual({ reasons: ["Chest pain", "Breathlessness"], source: "router" });
    expect(groqCalls()).toHaveLength(0);
  });

  it("answers no emergency without ever calling Groq, even when the router is undecided", async () => {
    fetchMock.mockResolvedValueOnce(json(ROUTER.clarifySpecialty));
    const { body } = await ask({ query: "dr sharma", safetyOnly: true });
    expect(body).toEqual({ safetyOnly: true, emergency: null });
    expect(groqCalls()).toHaveLength(0);
  });

  it("answers no emergency when the router is unreachable, without Groq", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { body } = await ask({ query: "skin specialist", safetyOnly: true });
    expect(body).toEqual({ safetyOnly: true, emergency: null });
    expect(groqCalls()).toHaveLength(0);
  });
});

describe("search parse: legacy router and no router", () => {
  it("legacy router, 1-3 candidates: its answer", async () => {
    fetchMock.mockResolvedValueOnce(json(ROUTER.legacyDecisive));
    const { body } = await ask({ query: "skin pe daane" });
    expect(body.specialtyIds).toEqual(["dermatology"]);
    expect(body.decision).toBeNull();
    expect(groqCalls()).toHaveLength(0);
  });

  it("legacy router, 5 candidates: Groq decides", async () => {
    fetchMock
      .mockResolvedValueOnce(json(ROUTER.legacyHedge))
      .mockResolvedValueOnce(groqSays({ specialtyId: "neurology", city: null, keywords: [], emergency: false, emergencyReasons: [] }));
    const { body } = await ask({ query: "sir dard" });
    expect(body.specialtyIds).toEqual(["neurology"]);
    expect(groqCalls()).toHaveLength(1);
  });

  it("router unreachable: Groq, and Groq's emergency check counts", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(groqSays({ specialtyId: "cardiology", city: null, keywords: ["seene"], emergency: true, emergencyReasons: ["Chest pain"] }));
    const { body } = await ask({ query: "seene mein bahut dard aur paseena" });
    expect(body.emergency).toEqual({ reasons: ["Chest pain"], source: "groq" });
    expect(body.specialtyIds).toEqual(["emergencymedicine"]);
  });

  it("no router configured and no Groq key: notConfigured", async () => {
    await load({ NLP_ROUTER_BASE_URL: "", GROQ_API_KEY: "" });
    const { body } = await ask({ query: "pet dard" });
    expect(body).toEqual({ notConfigured: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an empty query", async () => {
    const { status } = await ask({ query: "  " });
    expect(status).toBe(400);
  });
});
