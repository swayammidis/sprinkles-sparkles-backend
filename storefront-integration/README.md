# Storefront integration kit

A drop-in API client for the existing Sprinkle & Sparkle customer website. It was
written without access to the storefront repository, so the product type field names
may need small adjustments to match the existing components.

```
Database → Admin app (/api/public/*) → DTO (api-types.ts) → mappers.ts → src/types/product.ts → ProductCard / ProductPage / Cart
```

## Install

1. Copy `src/lib/api/*` → storefront `src/lib/api/`
2. Copy `src/types/product.ts` → storefront `src/types/product.ts` (or merge into the existing Product type)
3. Add to the storefront `.env.local`:
   ```
   CATALOG_API_URL=http://localhost:3001
   ```
4. Add the storefront origin to the admin app's `STOREFRONT_ORIGINS` (only needed for browser-side calls; Server Components don't need CORS).

## Usage (Server Components)

```tsx
import { notFound } from "next/navigation";
import { getProductBySlug, getFeaturedProducts, formatPaise } from "@/lib/api";

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  return <h1>{product.name} — {formatPaise(product.price)}</h1>;
}
```

## Migration from mock data

1. Find components importing mock product arrays.
2. Replace each import with the matching function (`getProducts`, `getCategoryProducts`, `getFeaturedProducts`…).
3. If a component expects the old mock shape, adapt it **in `mappers.ts`** instead of in the component.
4. The cart should store `variantId`/`productId` + quantity only. Always re-read prices from the API at checkout (Phase 2): never trust prices kept in the browser.

## Rules

- Don't call `fetch` for catalog data anywhere else. Use these functions.
- Money is integer **paise** in the storefront types. Don't do arithmetic on rupee floats.
- `api-types.ts` mirrors the admin app's `src/types/public-api.ts`. Keep them in sync.
