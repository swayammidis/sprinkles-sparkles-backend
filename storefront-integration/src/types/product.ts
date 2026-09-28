/**
 * Storefront domain types, independent of both MongoDB and the API wire format:
 *
 *   MongoDB → Admin API (DTO) → mappers.ts → these types → ProductCard / ProductPage / Cart
 *
 * Money is integer paise (₹1 = 100 paise) so cart arithmetic is exact.
 * If your existing components use different field names, adapt mappers.ts, not the components.
 */

export type Paise = number;

export type ProductImage = { url: string; alt: string };
export type TaxonomyRef = { name: string; slug: string };

export type ProductVariant = {
  id: string;
  label: string; // "250g", "8 inch", "Pink"
  sku: string | null;
  price: Paise; // what the customer pays for this option
  compareAtPrice: Paise | null; // original price when on sale
  inStock: boolean;
  image: ProductImage | null;
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  price: Paise; // what the customer pays (sale price, or "from" price for products with options)
  compareAtPrice: Paise | null;
  hasVariants: boolean;
  inStock: boolean;
  image: ProductImage | null;
  category: TaxonomyRef | null;
  subcategory: TaxonomyRef | null;
  brand: TaxonomyRef | null;
  badges: { featured: boolean; newArrival: boolean; bestSeller: boolean; onSale: boolean };
};

export type Product = ProductSummary & {
  sku: string | null;
  description: string;
  images: ProductImage[];
  variantType: string | null; // "Size", "Weight", "Colour", …
  variants: ProductVariant[];
  collections: TaxonomyRef[];
  occasions: TaxonomyRef[];
  tags: string[];
  seo: { title: string; description: string; image: string | null };
};

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };
