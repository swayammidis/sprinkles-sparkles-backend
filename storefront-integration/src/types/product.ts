/**
 * Storefront domain types. Independent of both Prisma and the API wire format:
 *
 *   Database → Admin API (DTO) → mappers.ts → these types → ProductCard / ProductPage / Cart
 *
 * Money is an integer number of paise (₹1 = 100 paise) so cart arithmetic is exact.
 * Adapt field names here to match the existing storefront components; only
 * mappers.ts needs to change if the API evolves.
 */

export type Paise = number;

export type ProductImage = { url: string; alt: string };

export type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  price: Paise;
  compareAtPrice: Paise | null; // original price when on sale
  inStock: boolean;
  image: ProductImage | null;
  options: Record<string, string>; // { Size: "8 inch" }
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  price: Paise; // what the customer pays (sale price if any, or "from" price)
  compareAtPrice: Paise | null;
  hasVariants: boolean;
  inStock: boolean;
  image: ProductImage | null;
  category: { name: string; slug: string } | null;
  badges: { featured: boolean; newArrival: boolean; bestSeller: boolean; onSale: boolean };
};

export type Product = ProductSummary & {
  sku: string;
  description: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  subcategory: { name: string; slug: string } | null;
  brand: { name: string; slug: string } | null;
  collections: { name: string; slug: string }[];
  occasions: { name: string; slug: string }[];
  seo: { title: string; description: string | null; image: string | null };
};

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };
