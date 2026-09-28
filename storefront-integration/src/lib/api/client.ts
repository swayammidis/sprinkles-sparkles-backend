/**
 * Storefront → Catalog API client (drop into the customer website at src/lib/api/).
 *
 * All catalog fetches go through here — never call fetch() for catalog data
 * directly from components. Server Components call these functions directly;
 * the base URL is a server-only env var so it is never shipped to the browser.
 *
 *   CATALOG_API_URL=https://admin.sprinkleandsparkle.in   (no trailing slash)
 */

export class CatalogApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const BASE_URL = process.env.CATALOG_API_URL ?? process.env.NEXT_PUBLIC_CATALOG_API_URL ?? "http://localhost:3001";

export type Query = Record<string, string | number | boolean | undefined | null>;

function toSearch(query?: Query) {
  if (!query) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * GET a public catalog endpoint. Returns `null` for 404 so pages can call notFound().
 * `revalidate` controls Next.js data caching (seconds).
 */
export async function catalogGet<T>(path: string, query?: Query, revalidate = 60): Promise<T | null> {
  const res = await fetch(`${BASE_URL}/api/public${path}${toSearch(query)}`, {
    headers: { Accept: "application/json" },
    next: { revalidate, tags: ["catalog"] },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new CatalogApiError(res.status, `Catalog API ${path} failed with ${res.status}`);
  const body = (await res.json()) as { data: T };
  return body.data;
}
