import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
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
  /** The server did not answer in time. The request may still have gone through, so check before trying again. */
  get isTimeout() {
    return this.status === 0 && (this.body as { timedOut?: boolean } | undefined)?.timedOut === true;
  }
}

export const TIMEOUT_MESSAGE = "The server is taking too long to answer. Please check in a moment whether it went through before trying again.";

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
  // The rate limiter's own 429 body (if any) is not patient-friendly; always say what to do.
  if (status === 429) return "Too many tries. Please wait a minute and try again.";
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const m = (b.message ?? b.Message) as string | undefined;
    if (m && typeof m === "string") return m;
    // ASP.NET validation answer: { title, errors: { Field: ["…"] } } — show the first real reason.
    const errors = b.errors as Record<string, string[]> | undefined;
    const first = errors ? Object.values(errors).flat().find((x) => typeof x === "string") : undefined;
    if (first) return first;
    if (typeof b.title === "string") return b.title;
  }
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
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? config.requestTimeoutMs);
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
    // A slow server is not the same as no internet: say which, because a timed-out save may still have been saved.
    if (timedOut) throw new ApiError(TIMEOUT_MESSAGE, 0, { timedOut: true });
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

/**
 * Multipart file upload to EasyHMS `/public/*`. On phones it uses Expo's native uploader (reads the file straight from
 * disk, works for camera photos and picked files of any size, and reports the server's real answer); on web, fetch.
 */
export async function apiUpload<T>(path: string, file: { uri: string; name: string; mimeType: string }, opts: { fieldName: string; parameters: Record<string, string>; timeoutMs?: number }): Promise<T> {
  if (Platform.OS === "web") {
    const form = new FormData();
    form.append(opts.fieldName, { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    for (const [k, v] of Object.entries(opts.parameters)) form.append(k, v);
    return api<T>(path, { body: form, timeoutMs: opts.timeoutMs });
  }
  const token = tokenProvider();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let result: FileSystem.FileSystemUploadResult;
  try {
    const task = FileSystem.uploadAsync(`${config.apiBaseUrl}${path}`, file.uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: opts.fieldName,
      mimeType: file.mimeType,
      parameters: opts.parameters,
      headers,
    });
    const limit = opts.timeoutMs ?? 120000;
    result = await Promise.race([
      task,
      new Promise<never>((_, reject) => setTimeout(() => reject(new ApiError(TIMEOUT_MESSAGE, 0, { timedOut: true })), limit)),
    ]);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("No internet connection. Check your network and try again.", 0);
  }

  let body: unknown = undefined;
  if (result.body) {
    try {
      body = JSON.parse(result.body);
    } catch {
      body = result.body;
    }
  }
  if (result.status < 200 || result.status >= 300) {
    if (result.status === 401 && token) onUnauthorized();
    if (result.status === 413) throw new ApiError("This file is too big to upload. Try a smaller photo or a PDF under 10 MB.", 413, body);
    throw new ApiError(messageFrom(body, result.status), result.status, body);
  }
  return body as T;
}
