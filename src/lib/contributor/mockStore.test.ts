import { beforeEach, describe, expect, it } from "vitest";
import * as s from "./mockStore";
import type { RegisterInput } from "./types";

const base: RegisterInput = {
  fullName: "Dr. Kavita Rao", photoUrl: null, bio: "", speciality: "Cardiologist", qualification: "MBBS, MD", registrationNumber: "52871",
  registrationCouncil: "Maharashtra Medical Council", registrationYear: "2009", roleTitle: "", organisation: "", fieldOfWork: "", consent: true,
};
const draft = { type: "MEDICAL" as const, title: "A new guide", description: "d", content: "## Hi\n\ntext", coverImageUrl: null, coverImageAlt: null, relatedConditionSlug: null, disclosure: null, references: null };

beforeEach(() => s.resetMock());

describe("invites", () => {
  it("returns the invite details with a masked mobile number", () => {
    const i = s.getInvite("demo-review");
    expect(i.kind).toBe("REVIEW");
    expect(i.articleTitle).toBe("Living with High Blood Pressure");
    expect(i.maskedMobile).not.toContain("9876544127");
  });
  it.each([["demo-used", 410], ["demo-expired", 410], ["nope", 404]])("%s -> %i", (t, status) => {
    expect(() => s.getInvite(t)).toThrowError(expect.objectContaining({ status }));
  });
  it("only sends a code to the number the link was meant for", () => {
    expect(() => s.sendOtp("9000000000", "demo-review")).toThrowError(expect.objectContaining({ status: 403 }));
    expect(s.sendOtp("9876544127", "demo-review").sent).toBe(true);
  });
});

describe("signing in", () => {
  it("rejects a bad code and a bad number", () => {
    expect(() => s.verifyOtp("9876544127", "000000", { inviteToken: "demo-review" })).toThrowError(expect.objectContaining({ status: 401 }));
    expect(() => s.sendOtp("12345")).toThrowError(expect.objectContaining({ status: 400 }));
  });
  it("makes a new person register, and gives an invited reviewer the article", () => {
    const r = s.verifyOtp("9876544127", "123456", { inviteToken: "demo-review" });
    expect(r.needsRegistration).toBe(true);
    const id = s.contributorForSession(r.sessionId);
    expect(s.listArticles(id).pending.map((a) => a.slug)).toEqual(["high-blood-pressure"]);
    expect(() => s.getInvite("demo-review")).toThrowError(expect.objectContaining({ status: 410 }));
  });
  it("signs a returning person straight in", () => {
    const r = s.verifyOtp("9891122002", "123456", {});
    expect(r.needsRegistration).toBe(false);
    expect(s.getMe(s.contributorForSession(r.sessionId)).fullName).toBe("Dr. Imran Qureshi");
  });
  it("needs a role for a self-enrolling stranger", () => {
    expect(() => s.verifyOtp("9000011111", "123456", {})).toThrowError(expect.objectContaining({ status: 400 }));
    expect(s.verifyOtp("9000011111", "123456", { role: "HEALTH_WORKER" }).needsRegistration).toBe(true);
  });
  it("does not accept a session that does not exist", () => {
    expect(() => s.contributorForSession("nope")).toThrowError(expect.objectContaining({ status: 401 }));
  });
});

describe("registering", () => {
  const signUp = (role: "INDEPENDENT_DOCTOR" | "WRITER" = "INDEPENDENT_DOCTOR") => s.contributorForSession(s.verifyOtp("9000022222", "123456", { role }).sessionId);

  it("needs registration number and council for a doctor, and consent", () => {
    const id = signUp();
    expect(() => s.register(id, { ...base, registrationNumber: "" })).toThrowError(expect.objectContaining({ status: 400 }));
    expect(() => s.register(id, { ...base, consent: false })).toThrowError(expect.objectContaining({ status: 400 }));
  });
  it("needs a job title for a writer, but no registration number", () => {
    const id = signUp("WRITER");
    expect(() => s.register(id, { ...base, roleTitle: "" })).toThrowError(expect.objectContaining({ status: 400 }));
    const me = s.register(id, { ...base, fullName: "Rohan Mehta", roleTitle: "Product manager", registrationNumber: "" });
    expect(me.status).toBe("PENDING");
    expect(me.registrationNumber).toBeNull();
  });
  it("never returns the full mobile number", () => {
    const id = signUp();
    const me = s.register(id, base);
    expect(JSON.stringify(me)).not.toContain("9000022222");
    expect("mobile" in me).toBe(false);
  });
});

describe("articles", () => {
  const verified = () => s.contributorForSession(s.verifyOtp("9891122002", "123456", {}).sessionId);
  const pending = () => {
    const id = s.contributorForSession(s.verifyOtp("9000022222", "123456", { role: "INDEPENDENT_DOCTOR" }).sessionId);
    s.register(id, base);
    return id;
  };

  it("groups articles into pending, published and drafts", () => {
    const l = s.listArticles(verified());
    expect(l.pending).toHaveLength(2);
    expect(l.pending[0].waitingDays).toBeGreaterThanOrEqual(l.pending[1].waitingDays ?? 0);
    expect(l.published).toHaveLength(2);
    expect(l.drafts).toHaveLength(1);
  });
  it("lets a verified author submit a draft, which then cannot be edited", () => {
    const id = verified();
    const a = s.createDraft(id, draft);
    expect(s.submitArticle(id, a.slug).status).toBe("IN_REVIEW");
    expect(() => s.updateDraft(id, a.slug, draft)).toThrowError(expect.objectContaining({ status: 409 }));
  });
  it("blocks submit until the profile is verified", () => {
    const id = pending();
    const a = s.createDraft(id, draft);
    expect(() => s.submitArticle(id, a.slug)).toThrowError(expect.objectContaining({ status: 403 }));
  });
  it("needs alt text on a cover image to submit", () => {
    const id = verified();
    const a = s.createDraft(id, { ...draft, coverImageUrl: "/x.png", coverImageAlt: " " });
    expect(() => s.submitArticle(id, a.slug)).toThrowError(expect.objectContaining({ status: 400 }));
  });
  it("keeps a writer to sector updates", () => {
    const id = s.contributorForSession(s.verifyOtp("9000033333", "123456", { role: "WRITER" }).sessionId);
    expect(() => s.createDraft(id, draft)).toThrowError(expect.objectContaining({ status: 403 }));
    expect(s.createDraft(id, { ...draft, type: "SECTOR_UPDATE" }).type).toBe("SECTOR_UPDATE");
  });
  it("gives a draft a unique slug from its title", () => {
    const id = verified();
    expect(s.createDraft(id, draft).slug).toBe("a-new-guide");
    expect(s.createDraft(id, draft).slug).toBe("a-new-guide-2");
  });
});

describe("review", () => {
  const verified = () => s.contributorForSession(s.verifyOtp("9891122002", "123456", {}).sessionId);

  it("publishes on approval and starts the counts at zero", () => {
    const id = verified();
    const a = s.reviewArticle(id, "thyroid-basics", { decision: "APPROVE" });
    expect(a.status).toBe("PUBLISHED");
    expect(a.views).toBe(0);
    expect(a.awaitingVerification).toBe(false);
  });
  it("holds an approval from an unverified doctor until they are verified", () => {
    const id = s.contributorForSession(s.verifyOtp("9876544127", "123456", { inviteToken: "demo-review" }).sessionId);
    s.register(id, base);
    expect(s.reviewArticle(id, "high-blood-pressure", { decision: "APPROVE" }).awaitingVerification).toBe(true);
  });
  it("needs a real comment to ask for changes, and sends the article back", () => {
    const id = verified();
    expect(() => s.reviewArticle(id, "thyroid-basics", { decision: "REQUEST_CHANGES", comment: "no" })).toThrowError(expect.objectContaining({ status: 400 }));
    s.reviewArticle(id, "thyroid-basics", { decision: "REQUEST_CHANGES", comment: "Please add when to see a doctor." });
    expect(s.listArticles(id).pending.map((a) => a.slug)).toEqual(["high-blood-pressure"]);
  });
  it("only lets the assigned reviewer decide, and only once", () => {
    const id = verified();
    expect(() => s.reviewArticle(id, "silent-heart-attack", { decision: "APPROVE" })).toThrowError(expect.objectContaining({ status: 409 }));
    s.reviewArticle(id, "thyroid-basics", { decision: "APPROVE" });
    expect(() => s.reviewArticle(id, "thyroid-basics", { decision: "APPROVE" })).toThrowError(expect.objectContaining({ status: 409 }));
  });
});

describe("topics", () => {
  const verified = () => s.contributorForSession(s.verifyOtp("9891122002", "123456", {}).sessionId);
  const topic = { title: "A topic", type: "MEDICAL" as const, outline: "Outline", whyItMatters: "Why", conditionSlug: null, references: null };

  it("stops at five open requests", () => {
    const id = verified(); // already has 2 open (submitted, needs detail)
    for (let i = 0; i < 3; i++) s.createTopic(id, { ...topic, title: `T${i}` });
    expect(() => s.createTopic(id, topic)).toThrowError(expect.objectContaining({ status: 409 }));
  });
  it("needs the outline and the reason", () => {
    expect(() => s.createTopic(verified(), { ...topic, whyItMatters: " " })).toThrowError(expect.objectContaining({ status: 400 }));
  });
  it("moves a Needs detail request back to Submitted when detail is added", () => {
    const id = verified();
    expect(s.addTopicDetail(id, "t-2", { outline: "Ages 1 to 5, paracetamol only." }).status).toBe("SUBMITTED");
    expect(() => s.addTopicDetail(id, "t-1", { outline: "x" })).toThrowError(expect.objectContaining({ status: 409 }));
  });
});

describe("images", () => {
  it("serves back what was saved", () => {
    const url = s.saveImage("image/png", Buffer.from([1, 2, 3]));
    expect(url).toMatch(/^\/api\/contributor\/images\/img-/);
    expect(s.getImage(url.split("/").pop()!)?.type).toBe("image/png");
  });
});
