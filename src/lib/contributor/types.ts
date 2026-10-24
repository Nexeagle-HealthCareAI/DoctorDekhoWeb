// Shapes used by the contributor pages (/contribute). They match the contributor endpoints in
// docs/health-wiki-api-contract.md. Mobile numbers are never returned in full.

import type { ArticleType } from "@/lib/health-wiki/types";

export type { ArticleType };

/** Roles a person can enrol as. Hospital doctors use the EasyHMS app, not these pages. */
export type EnrolRole = "INDEPENDENT_DOCTOR" | "HEALTH_WORKER" | "WRITER";

/** Every role a signed-in contributor can have. A hospital doctor arrives from EasyHMS and never joins here. */
export type ContributorRole = EnrolRole | "HOSPITAL_DOCTOR";

export const ENROL_ROLE_LABEL: Record<EnrolRole, string> = {
  INDEPENDENT_DOCTOR: "Independent doctor",
  HEALTH_WORKER: "Health worker",
  WRITER: "Writer / technologist",
};

export const isDoctorRole = (r: ContributorRole) => r === "INDEPENDENT_DOCTOR" || r === "HOSPITAL_DOCTOR";

/**
 * A doctor the team has verified publishes their own articles (medical or sector update) with no review. The article stays in
 * review for someone else when the team pulled it back, and everyone who is not a verified doctor goes through review.
 */
export const canSelfPublish = (me: { role: ContributorRole; status: ContributorStatus }, article?: { holdForReview?: boolean; myRole: MyArticleRole }) =>
  isDoctorRole(me.role) && me.status === "VERIFIED" && !article?.holdForReview && (!article || article.myRole === "AUTHOR");

export type ContributorStatus = "INVITED" | "PENDING" | "VERIFIED" | "REJECTED";

export interface ContributorMe {
  id: string;
  role: ContributorRole;
  fullName: string;
  /** "+91 98••• ••127" */
  mobileMasked: string;
  status: ContributorStatus;
  speciality: string | null;
  qualification: string | null;
  roleTitle: string | null;
  organisation: string | null;
  registrationNumber: string | null;
  registrationCouncil: string | null;
  rejectReason: string | null;
}

export type ArticleStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED";

export type MyArticleRole = "AUTHOR" | "REVIEWER";

/** One article as the contributor sees it, either one they wrote or one they must review. */
export interface MyArticle {
  slug: string;
  type: ArticleType;
  title: string;
  description: string;
  /** Markdown. */
  content: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  relatedConditionSlug: string | null;
  disclosure: string | null;
  references: string | null;
  status: ArticleStatus;
  myRole: MyArticleRole;
  authorName: string;
  reviewerName: string | null;
  /** The team's or reviewer's comment on a draft that was sent back. */
  returnedComment: string | null;
  /** Whole days an article in review has been waiting. */
  waitingDays: number | null;
  /** The reviewer approved it, but the reviewer's registration is not verified yet, so it is not live. */
  awaitingVerification: boolean;
  /** The team pulled this article back to review: its author cannot publish it alone until it is approved. */
  holdForReview?: boolean;
  views: number | null;
  likes: number | null;
  publishedAt: string | null;
  updatedAt: string;
}

export type ArticleListTab = "pending" | "published" | "drafts";

export interface ArticleListResponse {
  pending: MyArticle[];
  published: MyArticle[];
  drafts: MyArticle[];
}

export interface ArticleDraftInput {
  type: ArticleType;
  title: string;
  description: string;
  content: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  relatedConditionSlug: string | null;
  disclosure: string | null;
  references: string | null;
}

export type TopicStatus = "SUBMITTED" | "NEEDS_DETAIL" | "ACCEPTED" | "DECLINED" | "ARTICLE_STARTED";

export const TOPIC_STATUS_LABEL: Record<TopicStatus, string> = {
  SUBMITTED: "Submitted",
  NEEDS_DETAIL: "Needs detail",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  ARTICLE_STARTED: "Article started",
};

export interface TopicInput {
  title: string;
  type: ArticleType;
  outline: string;
  whyItMatters: string;
  conditionSlug: string | null;
  references: string | null;
  /** A doctor asks the team to have someone else write it; the doctor then reviews it. */
  requestWriter?: boolean;
}

export interface TopicRequest extends TopicInput {
  id: string;
  status: TopicStatus;
  /** Reason when declined, or the detail the team asked for. */
  decisionNote: string | null;
  articleSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

export const OPEN_TOPIC_LIMIT = 5;

export type InviteKind = "REVIEW" | "WRITE" | "JOIN";

export interface InviteInfo {
  kind: InviteKind;
  role: EnrolRole;
  inviterName: string;
  maskedMobile: string;
  articleTitle: string | null;
  articleCoverUrl: string | null;
  /** The invited person's name, if the team already knew it. */
  inviteeName: string | null;
}

export interface RegisterInput {
  fullName: string;
  photoUrl: string | null;
  bio: string;
  // doctors
  speciality: string;
  qualification: string;
  registrationNumber: string;
  registrationCouncil: string;
  registrationYear: string;
  // health workers and writers
  roleTitle: string;
  organisation: string;
  fieldOfWork: string;
  consent: boolean;
}

export type ReviewDecision = { decision: "APPROVE"; accuracyConfirmed: true } | { decision: "REQUEST_CHANGES"; comment: string };

export const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  PUBLISHED: "Published",
};
