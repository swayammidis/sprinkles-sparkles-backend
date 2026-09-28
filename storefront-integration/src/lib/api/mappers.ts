/**
 * API DTO → storefront types. The ONLY place that knows the wire format.
 *
 * `api-types.ts` is a copy of the admin app's src/types/public-api.ts
 * (the API contract). Keep them in sync when the contract changes.
 */
import type { PublicImage, PublicProductDetail, PublicProductSummary, PublicVariant } from "./api-types";
import type { Paise, Product, ProductImage, ProductSummary, ProductVariant } from "@/types/product";

/** "249.50" → 24950. Exact: parses digits, no floating point. */
export function toPaise(money: string): Paise {
  const [whole, frac = ""] = money.split(".");
  return Number.parseInt(whole, 10) * 100 + Number.parseInt((frac + "00").slice(0, 2), 10);
}

export function formatPaise(paise: Paise): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

const image = (i: PublicImage | null): ProductImage | null => (i ? { url: i.url, alt: i.alt } : null);

function payable(price: string, salePrice: string | null) {
  return salePrice
    ? { price: toPaise(salePrice), compareAtPrice: toPaise(price) }
    : { price: toPaise(price), compareAtPrice: null };
}

export function mapProductSummary(p: PublicProductSummary): ProductSummary {
  const pricing = p.hasVariants ? { price: toPaise(p.fromPrice), compareAtPrice: null } : payable(p.price, p.salePrice);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    ...pricing,
    hasVariants: p.hasVariants,
    inStock: p.stockStatus !== "out_of_stock",
    image: image(p.image),
    category: p.category,
    badges: p.badges,
  };
}

export function mapVariant(v: PublicVariant): ProductVariant {
  return {
    id: v.id,
    name: v.name,
    sku: v.sku,
    ...payable(v.price, v.salePrice),
    inStock: v.stockStatus !== "out_of_stock",
    image: image(v.image),
    options: v.attributes,
  };
}

export function mapProduct(p: PublicProductDetail): Product {
  return {
    ...mapProductSummary(p),
    sku: p.sku,
    description: p.description,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
    variants: p.variants.map(mapVariant),
    subcategory: p.subcategory,
    brand: p.brand,
    collections: p.collections,
    occasions: p.occasions,
    seo: p.seo,
  };
}
