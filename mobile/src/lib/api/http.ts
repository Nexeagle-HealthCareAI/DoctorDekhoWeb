import { config } from "../config";

/** An API failure the UI can show as-is: `message` is already patient-friendly. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
  get isUnauthorized() {
    return this.status === 401;
  }
  get isNetwork() {
    return this.status === 0;
  }
}

// The session module registers how to read the current token and what to do when EasyHMS says it
// is no longer valid; this file stays free of React and storage concerns.
let tokenProvider: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export function configureHttp(opts: { getToken: () => string | null; onUnauthorized: () => void }) {
  tokenProvider = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Send the patient token (default true when one exists). */
  auth?: boolean;
  /** Absolute URL instead of the EasyHMS base. */
  url?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const m = (b.message ?? b.Message ?? b.title) as string | undefined;
    if (m && typeof m === "string") return m;
  }
  if (status === 429) return "Too many tries. Please wait a minute and try again.";
  if (status >= 500) return "Our server had a problem. Please try again.";
  if (status === 404) return "Not found.";
  return "Something went wrong. Please try again.";
}

/** JSON request to EasyHMS `/public/*` (or an absolute `url`). Throws ApiError on any non-2xx or network failure. */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const url = opts.url ?? `${config.apiBaseUrl}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  const token = opts.auth === false ? null : tokenProvider();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? config.requestTimeoutMs);
  opts.signal?.addEventListener("abort", () => controller.abort());

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("No internet connection. Check your network and try again.", 0);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(messageFrom(body, res.status), res.status, body);
  }
  return body as T;
}
