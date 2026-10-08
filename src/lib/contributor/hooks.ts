"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, contributorApi } from "./client";
import type { ContributorMe } from "./types";

/**
 * The signed-in contributor, or a redirect to the sign-in page. Contributor data is deliberately
 * not kept in the shared React Query cache: that cache is persisted in the browser, and these
 * pages hold personal details and unpublished drafts.
 */
export function useContributor() {
  const router = useRouter();
  const [me, setMe] = useState<ContributorMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    contributorApi
      .me()
      .then((m) => { if (alive) setMe(m); })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) router.replace(`/contribute/login?next=${encodeURIComponent(window.location.pathname)}`);
        else setError(e instanceof Error ? e.message : "Could not load your profile.");
      });
    return () => { alive = false; };
  }, [router]);

  return { me, error };
}

export interface Loaded<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (d: T | null) => void;
}

/** Load something once, and again on demand. Sends a signed-out visitor to sign in. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []): Loaded<T> {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadRef.current()
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) router.replace(`/contribute/login?next=${encodeURIComponent(window.location.pathname)}`);
        else setError(e instanceof Error ? e.message : "Could not load this page.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, router, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

/** Message to show for any thrown error. */
export const messageOf = (e: unknown, fallback = "Something went wrong. Try again.") => (e instanceof Error && e.message ? e.message : fallback);
