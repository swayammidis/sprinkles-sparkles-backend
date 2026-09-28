"use client";

/** Error thrown by apiFetch; carries per-field validation messages from the server. */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

/**
 * Minimal JSON client for the admin API. Same-origin only; the session cookie
 * is sent automatically and the browser adds the Origin header used for CSRF checks.
 */
export async function apiFetch<T = unknown>(
  url: string,
  init: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; formData?: FormData } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    headers: init.formData ? undefined : { "Content-Type": "application/json" },
    body: init.formData ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { message?: string; fieldErrors?: Record<string, string[]>; details?: { fieldErrors?: Record<string, string[]> } } }).error;
    if (res.status === 401) {
      window.location.replace(new URL(`/login?next=${encodeURIComponent(window.location.pathname)}`, window.location.origin).href);
    }
    throw new ApiClientError(
      res.status,
      err?.message ?? `Request failed (${res.status})`,
      err?.fieldErrors ?? err?.details?.fieldErrors ?? {},
    );
  }
  return data as T;
}
