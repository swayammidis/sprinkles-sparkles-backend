/**
 * Public storefront API contract (v1).
 *
 * These are the ONLY shapes the customer website receives. They are decoupled
 * from Prisma models: internal fields (exact stock counts, isDemo, timestamps
 * used for admin, SEO drafts of inactive products…) are never included.
 *
 * Money is a decimal string in INR, e.g. "249.00". Parse with a decimal-safe
 * approach (or convert to paise) — never add floats.
 */

export type Money = string;

export type PublicImage = {
  url: string;
  alt: string;
  isPrimary: boolean;
};

export type PublicTaxonomyRef = { name: string; slug: string };

export type PublicStockStatus = "in_stock" | "out_of_stock" | "backorder";

export type PublicVariant = {
  id: string;
  name: string;
  sku: string;
  price: Money;
  salePrice: Money | null;
  stockStatus: PublicStockStatus;
  weightGrams: string | null;
  image: PublicImage | null;
  /** e.g. { Size: "8 inch", Colour: "Pink" } */
  attributes: Record<string, string>;
};

export type PublicProductSummary = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  sku: string;
  price: Money;
  salePrice: Money | null;
  /** Lowest active variant price (or product price when no variants). */
  fromPrice: Money;
  currency: "INR";
  stockStatus: PublicStockStatus;
  hasVariants: boolean;
  image: PublicImage | null;
  category: PublicTaxonomyRef | null;
  subcategory: PublicTaxonomyRef | null;
  brand: PublicTaxonomyRef | null;
  badges: { featured: boolean; newArrival: boolean; bestSeller: boolean; onSale: boolean };
};

export type PublicProductDetail = PublicProductSummary & {
  description: string | null;
  images: PublicImage[];
  variants: PublicVariant[];
  collections: PublicTaxonomyRef[];
  occasions: PublicTaxonomyRef[];
  shipping: { weightGrams: string | null; lengthCm: string | null; widthCm: string | null; heightCm: string | null };
  seo: { title: string; description: string | null; image: string | null };
};

export type PublicCategory = {
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  subcategories: { name: string; slug: string; description: string | null; image: string | null }[];
};

export type PublicCollection = {
  name: string;
  slug: string;
  description: string | null;
  bannerImage: string | null;
};

export type PublicOccasion = {
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
};

export type PublicBrand = {
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
};

export type Paginated<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type PublicProductSort = "newest" | "price_asc" | "price_desc" | "name_asc" | "name_desc" | "featured";
