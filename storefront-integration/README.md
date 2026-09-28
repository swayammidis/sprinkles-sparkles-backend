# Storefront integration kit

A drop-in catalog client for the Sprinkle & Sparkle **customer website**. It connects the
website to the admin panel's public, read-only API, so products the store owner publishes
appear on the site.

```
MongoDB → Admin app /api/public/* (DTO) → mappers.ts → src/types/product.ts → ProductCard / ProductPage / Cart
```

It was written without access to the storefront repository. Field names in
`src/types/product.ts` may need small adjustments to match the existing components; make
those adjustments in `mappers.ts`, not in the components.

## Install

1. Copy `src/lib/api/*` into the storefront's `src/lib/api/`.
2. Copy `src/types/product.ts` into `src/types/product.ts`, or merge it into the existing Product type.
3. Add this to the storefront `.env.local`:
   ```
   CATALOG_API_URL=http://localhost:3001      # the admin app's URL
   ```
4. In the admin app's `.env.local`, set `STOREFRONT_ORIGINS` to the storefront URL. This is only
   needed for browser-side calls; Server Components don't need it.

## Examples (Server Components)

```tsx
// Shop → Sprinkles
import { getProductsByCategory, getCategory, formatPaise } from "@/lib/api";

export default async function CategoryPage({ params }: PageProps<"/shop/[category]">) {
  const { category } = await params;
  const [info, products] = await Promise.all([getCategory(category), getProductsByCategory(category, { sort: "newest" })]);
  if (!info) notFound();
  return products.items.map((p) => (
    <ProductCard key={p.id} name={p.name} price={formatPaise(p.price)} image={p.image?.url} href={`/products/${p.slug}`} />
  ));
}
```

```tsx
// Product page
const product = await getProductBySlug(slug); // null → notFound()
product.variantType; // "Size"
product.variants;    // [{ label: "250g", price: 32000, inStock: true, … }]
```

| Need | Function |
|---|---|
| All products (search, filter, sort, paginate) | `getProducts({ search, category, subcategory, collection, occasion, brand, featured, newArrival, onSale, inStock, minPrice, maxPrice, sort, page, pageSize })` |
| Product by slug | `getProductBySlug(slug)` |
| Featured / new arrivals / best sellers | `getFeaturedProducts()`, `getNewArrivals()`, `getBestSellers()` |
| Products by category / subcategory / collection / occasion | `getProductsByCategory(slug)`, `getProductsBySubcategory(slug)`, `getCollectionProducts(slug)`, `getOccasionProducts(slug)` |
| Navigation | `getCategories()` (with subcategories), `getCollections()`, `getOccasions()`, `getBrands()` |
| Footer / contact page | `getStoreInfo()` |

## Replacing mock data

1. Find the components that import mock product arrays.
2. Replace each import with the matching function above.
3. The cart should store `productId`, `variantId` and quantity only. At checkout (a future phase),
   always re-read prices from the server. Never trust prices stored in the browser.

## Rules

- Only **Published** products in **active** categories are returned. Drafts never appear.
- Money in the storefront types is integer **paise**. Use `formatPaise()` to display it.
- `api-types.ts` mirrors the admin app's `src/types/public-api.ts`.
