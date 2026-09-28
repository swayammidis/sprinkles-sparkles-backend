"use client";

/** Error from the admin API, with per-field messages when the server sent them. */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Same-origin JSON client for /api/admin/*. The browser sends the session cookie and Origin header. */
export async function apiFetch<T = unknown>(
  url: string,
  init: { method?: string; body?: unknown; formData?: FormData } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.formData ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    });
  } catch {
    throw new ApiClientError(0, "Can't reach the server. Please check your internet connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string> };
  if (res.status === 401) {
    window.location.replace(new URL("/login?reason=expired", window.location.origin).href);
  }
  if (!res.ok) {
    const fallback = res.status >= 500 ? "Something went wrong on our side. Please try again." : "That didn't work. Please try again.";
    throw new ApiClientError(res.status, data.error ?? fallback, data.fieldErrors);
  }
  return data as T;
}

/** A human message for any thrown error. */
export const errorMessage = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.");
