"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import type { WikiArticle } from "@/lib/wikiStore";

interface DoctorOption {
  id: string;
  name: string;
  specialty: string;
  qualifications: string;
}

const STATUS_LABEL: Record<WikiArticle["status"], string> = {
  draft: "Draft",
  in_review: "In Review",
  published: "Published",
};

const STATUS_CLASS: Record<WikiArticle["status"], string> = {
  draft: "bg-slate-100 text-slate-600",
  in_review: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
};

export default function HealthWikiArticleDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [article, setArticle] = useState<WikiArticle | null>(null);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [relatedConditionSlug, setRelatedConditionSlug] = useState("");
  const [authorId, setAuthorId] = useState("");

  const [reviewerId, setReviewerId] = useState("");
  const [comments, setComments] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/wiki-articles/${params.id}`),
      fetch("/api/admin/doctors"),
    ]).then(async ([articleRes, doctorsRes]) => {
      if (articleRes.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (articleRes.status === 404) {
        setNotFound(true);
        return;
      }
      const { article: a } = await articleRes.json();
      const { doctors: d } = await doctorsRes.json();
      setArticle(a);
      setDoctors(d);
      setTitle(a.title);
      setDescription(a.description);
      setContent(a.content);
      setRelatedConditionSlug(a.relatedConditionSlug);
      setAuthorId(a.authorId);
    });
  }, [params.id, router]);

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/wiki-articles/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, content, relatedConditionSlug, authorId }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save.");
      return;
    }
    const { article: a } = await res.json();
    setArticle(a);
  }

  async function handleSubmitForReview() {
    await handleSaveDraft();
    setSaving(true);
    const res = await fetch(`/api/admin/wiki-articles/${params.id}/submit`, { method: "POST" });
    setSaving(false);
    if (res.ok) {
      const { article: a } = await res.json();
      setArticle(a);
    }
  }

  async function handleReview(decision: "approved" | "changes_requested") {
    if (!reviewerId) {
      setError("Pick a reviewer first.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/wiki-articles/${params.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewerId, decision, comments }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not submit the review.");
      return;
    }
    const { article: a } = await res.json();
    setArticle(a);
    setComments("");
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Article not found. <Link href="/admin/health-wiki" className="text-brand-teal font-semibold">Back to list</Link></p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  const author = doctors.find((d) => d.id === article.authorId);
  const isEditable = article.status === "draft";
  const isReviewable = article.status === "in_review";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div>
            <Link href="/admin/health-wiki" className="text-xs font-semibold text-slate-500 hover:text-slate-800">← Back</Link>
            <h1 className="text-xl font-extrabold text-slate-900 mt-1">{article.title || "Untitled"}</h1>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_CLASS[article.status]}`}>
            {STATUS_LABEL[article.status]}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {article.status === "published" && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-800">
            Live at{" "}
            <Link href={`/health/conditions/${article.id}`} className="font-bold underline" target="_blank">
              /health/conditions/{article.id}
            </Link>
          </div>
        )}

        {article.reviewComments && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800">
            <p className="font-bold mb-1">Reviewer comments</p>
            <p>{article.reviewComments}</p>
          </div>
        )}

        {isEditable ? (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:border-brand-teal/40" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Short description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:border-brand-teal/40" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Content</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono shadow-sm focus:outline-none focus:border-brand-teal/40" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Related condition slug</label>
              <input value={relatedConditionSlug} onChange={(e) => setRelatedConditionSlug(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:border-brand-teal/40" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Author</label>
              <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:border-brand-teal/40">
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button onClick={handleSaveDraft} disabled={saving} className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm shadow-sm hover:bg-slate-50 disabled:opacity-40 transition">
                Save
              </button>
              <button onClick={handleSubmitForReview} disabled={saving} className="px-5 py-3 rounded-xl bg-brand-teal text-white font-bold text-sm shadow-md shadow-teal-500/20 hover:bg-brand-teal/90 disabled:opacity-40 transition">
                Submit for Review
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <p className="text-sm text-slate-500 mb-4">{article.description}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Author</p>
              <p className="text-sm text-slate-800 mb-4">{author ? `${author.name} — ${author.specialty}` : article.authorId}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Content</p>
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">{article.content}</pre>
            </div>

            {isReviewable && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <p className="text-sm font-extrabold text-slate-900">Review this article</p>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Reviewer (doctor)</label>
                  <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:border-brand-teal/40">
                    <option value="" disabled>Select a reviewer...</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} — {d.qualifications}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Comments (optional, required if requesting changes)</label>
                  <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:border-brand-teal/40" />
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="flex gap-3">
                  <button onClick={() => handleReview("changes_requested")} disabled={saving} className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm shadow-sm hover:bg-slate-50 disabled:opacity-40 transition">
                    Request Changes
                  </button>
                  <button onClick={() => handleReview("approved")} disabled={saving} className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-md hover:bg-emerald-700 disabled:opacity-40 transition">
                    Approve &amp; Publish
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
