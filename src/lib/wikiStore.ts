import { readFile, writeFile } from "fs/promises";
import path from "path";

// Server-only. A JSON-file-backed store standing in for the EasyHMS CMS endpoints described in
// the "Health Wiki CMS API" spec (draft/review/publish) -- this repo has no write access to
// EasyHMS today, so this lets the write-review-publish workflow actually work on localhost now.
// Swap this module for real EasyHMS API calls later; nothing outside this file (admin routes,
// public pages) needs to change since they only ever call these functions.

export type ArticleStatus = "draft" | "in_review" | "published";

export interface WikiArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  relatedConditionSlug: string;
  authorId: string;
  reviewerId?: string;
  status: ArticleStatus;
  reviewComments?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

const DATA_PATH = path.join(process.cwd(), "src/data/wiki-articles.json");

async function readAll(): Promise<WikiArticle[]> {
  const raw = await readFile(DATA_PATH, "utf-8");
  return JSON.parse(raw) as WikiArticle[];
}

async function writeAll(articles: WikiArticle[]): Promise<void> {
  await writeFile(DATA_PATH, JSON.stringify(articles, null, 2) + "\n", "utf-8");
}

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function getAllArticles(): Promise<WikiArticle[]> {
  return readAll();
}

export async function getPublishedArticles(): Promise<WikiArticle[]> {
  const all = await readAll();
  return all.filter((a) => a.status === "published");
}

export async function getArticleById(id: string): Promise<WikiArticle | undefined> {
  const all = await readAll();
  return all.find((a) => a.id === id);
}

export async function createDraft(input: {
  title: string;
  description: string;
  content: string;
  relatedConditionSlug: string;
  authorId: string;
}): Promise<WikiArticle> {
  const all = await readAll();
  const baseSlug = slugify(input.title);
  let id = baseSlug;
  let n = 2;
  while (all.some((a) => a.id === id)) {
    id = `${baseSlug}-${n}`;
    n += 1;
  }
  const now = new Date().toISOString();
  const article: WikiArticle = {
    id,
    title: input.title,
    description: input.description,
    content: input.content,
    relatedConditionSlug: input.relatedConditionSlug,
    authorId: input.authorId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  all.push(article);
  await writeAll(all);
  return article;
}

export async function updateArticle(
  id: string,
  patch: Partial<Pick<WikiArticle, "title" | "description" | "content" | "relatedConditionSlug" | "authorId">>
): Promise<WikiArticle | undefined> {
  const all = await readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return undefined;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[idx];
}

export async function submitForReview(id: string): Promise<WikiArticle | undefined> {
  const all = await readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return undefined;
  all[idx] = { ...all[idx], status: "in_review", updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[idx];
}

export async function reviewArticle(
  id: string,
  input: { reviewerId: string; decision: "approved" | "changes_requested"; comments?: string }
): Promise<WikiArticle | undefined> {
  const all = await readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return undefined;
  const now = new Date().toISOString();
  if (input.decision === "approved") {
    all[idx] = {
      ...all[idx],
      status: "published",
      reviewerId: input.reviewerId,
      reviewComments: input.comments,
      publishedAt: all[idx].publishedAt ?? now,
      updatedAt: now,
    };
  } else {
    all[idx] = {
      ...all[idx],
      status: "draft",
      reviewComments: input.comments,
      updatedAt: now,
    };
  }
  await writeAll(all);
  return all[idx];
}
