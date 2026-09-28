/**
 * Storefront → Catalog API client. Copy into the customer website at src/lib/api/.
 *
 * All catalog data is fetched through these functions — never call fetch() for
 * catalog data directly inside components. Works in Server Components (preferred)
 * and in the browser (the admin app must list the storefront origin in STOREFRONT_ORIGINS).
 *
 *   CATALOG_API_URL=https://admin.yourdomain.com   (server-side, no trailing slash)
 */

export class CatalogApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const BASE_URL = (process.env.CATALOG_API_URL ?? process.env.NEXT_PUBLIC_CATALOG_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

export type Query = Record<string, string | number | boolean | undefined | null>;

function toSearch(query?: Query) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * GET a public catalog endpoint. Returns null on 404 so pages can call notFound().
 * `revalidate` = seconds Next.js may cache the response (products change often; taxonomy rarely).
 */
export async function catalogGet<T>(path: string, query?: Query, revalidate = 60): Promise<T | null> {
  const res = await fetch(`${BASE_URL}/api/public${path}${toSearch(query)}`, {
    headers: { Accept: "application/json" },
    next: { revalidate, tags: ["catalog"] },
  } as RequestInit);
  if (res.status === 404) return null;
  if (!res.ok) throw new CatalogApiError(res.status, `Catalog API ${path} failed (${res.status})`);
  return ((await res.json()) as { data: T }).data;
}
