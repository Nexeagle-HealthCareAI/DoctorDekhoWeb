"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/admin/health-wiki");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Login failed.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <p className="text-[11px] font-bold text-brand-teal uppercase tracking-widest mb-1">Doctor Dekho Admin</p>
        <h1 className="text-xl font-extrabold text-slate-900 mb-6">Health Wiki Sign In</h1>

        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 shadow-sm focus:outline-none focus:border-brand-teal/40 focus:ring-1 focus:ring-brand-teal/10 mb-4"
        />

        {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3 rounded-xl bg-brand-teal text-white font-bold text-sm shadow-md shadow-teal-500/20 disabled:opacity-40 hover:bg-brand-teal/90 active:scale-[0.98] transition"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
