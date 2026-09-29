"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DoctorOption {
  id: string;
  name: string;
  specialty: string;
  qualifications: string;
}

export default function NewHealthWikiArticlePage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [relatedConditionSlug, setRelatedConditionSlug] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/doctors")
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setDoctors(data.doctors);
      });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/wiki-articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, content, relatedConditionSlug, authorId }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Could not save the draft.");
      return;
    }
    const { article } = await res.json();
    router.push(`/admin/health-wiki/${article.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
          <Link href="/admin/health-wiki" className="text-xs font-semibold text-slate-500 hover:text-slate-800">← Back</Link>
          <h1 className="text-xl font-extrabold text-slate-900 mt-1">New Article</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 shadow-sm focus:outline-none focus:border-brand-teal/40 focus:ring-1 focus:ring-brand-teal/10"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Short description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 shadow-sm focus:outline-none focus:border-brand-teal/40 focus:ring-1 focus:ring-brand-teal/10"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
            Content <span className="font-normal normal-case text-slate-400">(use ## for headings, * for bullet points)</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 shadow-sm font-mono focus:outline-none focus:border-brand-teal/40 focus:ring-1 focus:ring-brand-teal/10"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Related condition slug</label>
          <input
            value={relatedConditionSlug}
            onChange={(e) => setRelatedConditionSlug(e.target.value)}
            placeholder="e.g. diabetes"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 shadow-sm focus:outline-none focus:border-brand-teal/40 focus:ring-1 focus:ring-brand-teal/10"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Author (doctor)</label>
          <select
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 shadow-sm focus:outline-none focus:border-brand-teal/40 focus:ring-1 focus:ring-brand-teal/10"
          >
            <option value="" disabled>Select a doctor...</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving || !title || !authorId}
          className="px-5 py-3 rounded-xl bg-brand-teal text-white font-bold text-sm shadow-md shadow-teal-500/20 disabled:opacity-40 hover:bg-brand-teal/90 active:scale-[0.98] transition"
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>
      </form>
    </div>
  );
}
