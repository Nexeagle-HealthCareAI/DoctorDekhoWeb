"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { WikiArticle } from "@/lib/wikiStore";

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

export default function HealthWikiAdminListPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<WikiArticle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/wiki-articles")
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        if (!res.ok) throw new Error("Failed to load articles.");
        return res.json();
      })
      .then((data) => {
        if (data) setArticles(data.articles);
      })
      .catch(() => setError("Could not load articles."));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-brand-teal uppercase tracking-widest">Doctor Dekho Admin</p>
            <h1 className="text-xl font-extrabold text-slate-900">Health Wiki</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/health-wiki/new"
              className="px-4 py-2 rounded-xl bg-brand-teal text-white text-sm font-bold shadow-sm hover:bg-brand-teal/90 transition"
            >
              + New Article
            </Link>
            <button onClick={handleLogout} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {!articles && !error && <p className="text-sm text-slate-500">Loading...</p>}

        {articles && articles.length === 0 && (
          <p className="text-sm text-slate-500">No articles yet. Create the first one.</p>
        )}

        {articles && articles.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {articles.map((a) => (
              <Link
                key={a.id}
                href={`/admin/health-wiki/${a.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50 transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Updated {new Date(a.updatedAt).toLocaleDateString()}</p>
                </div>
                <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_CLASS[a.status]}`}>
                  {STATUS_LABEL[a.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
