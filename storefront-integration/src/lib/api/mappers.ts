/**
 * API DTO → storefront types. The ONLY place that knows the wire format.
 * `api-types.ts` is a copy of the admin app's src/types/public-api.ts (the contract).
 */
import type { PublicImage, PublicProductDetail, PublicProductSummary, PublicVariant } from "./api-types";
import type { Paise, Product, ProductImage, ProductSummary, ProductVariant } from "@/types/product";

export function formatPaise(paise: Paise): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: paise % 100 ? 2 : 0 }).format(rupees);
}

const image = (i: PublicImage | null): ProductImage | null => (i ? { url: i.url, alt: i.alt } : null);

export function mapProductSummary(p: PublicProductSummary): ProductSummary {
  const onSale = !p.hasVariants && p.salePrice !== null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    price: p.fromPrice.paise,
    compareAtPrice: onSale ? p.price.paise : null,
    hasVariants: p.hasVariants,
    inStock: p.stockStatus !== "out_of_stock",
    image: image(p.image),
    category: p.category,
    subcategory: p.subcategory,
    brand: p.brand,
    badges: p.badges,
  };
}

export function mapVariant(v: PublicVariant): ProductVariant {
  return {
    id: v.id,
    label: v.label,
    sku: v.sku,
    price: v.salePrice?.paise ?? v.price.paise,
    compareAtPrice: v.salePrice ? v.price.paise : null,
    inStock: v.stockStatus !== "out_of_stock",
    image: image(v.image),
  };
}

export function mapProduct(p: PublicProductDetail): Product {
  return {
    ...mapProductSummary(p),
    sku: p.sku,
    description: p.description,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
    variantType: p.variantType,
    variants: p.variants.map(mapVariant),
    collections: p.collections,
    occasions: p.occasions,
    tags: p.tags,
    seo: p.seo,
  };
}
