/**
 * Public storefront API contract (v1): the ONLY shapes the customer website receives.
 * Decoupled from the Mongoose models: no internal fields (exact stock counts,
 * draft data, ObjectIds of relations, admin timestamps).
 *
 * Money is sent twice: as a decimal rupee string ("180.00") for display, and as
 * integer paise (18000) for exact arithmetic in the cart. Never add floats.
 */

export type PublicMoney = { amount: string; paise: number };

export type PublicImage = { url: string; alt: string };

export type PublicRef = { name: string; slug: string };

export type PublicStockStatus = "in_stock" | "out_of_stock" | "backorder";

export type PublicVariant = {
  id: string;
  label: string;
  sku: string | null;
  price: PublicMoney;
  salePrice: PublicMoney | null;
  stockStatus: PublicStockStatus;
  weightGrams: number | null;
  image: PublicImage | null;
};

export type PublicProductSummary = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  price: PublicMoney;
  salePrice: PublicMoney | null;
  /** What the customer pays (sale price, or the cheapest option for products with variants). */
  fromPrice: PublicMoney;
  currency: "INR";
  stockStatus: PublicStockStatus;
  hasVariants: boolean;
  image: PublicImage | null;
  category: PublicRef | null;
  subcategory: PublicRef | null;
  brand: PublicRef | null;
  badges: { featured: boolean; newArrival: boolean; bestSeller: boolean; onSale: boolean };
};

export type PublicProductDetail = PublicProductSummary & {
  sku: string | null;
  description: string;
  images: PublicImage[];
  variantType: string | null;
  variants: PublicVariant[];
  collections: PublicRef[];
  occasions: PublicRef[];
  tags: string[];
  shipping: { weightGrams: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null };
  seo: { title: string; description: string; image: string | null };
};

export type PublicTaxonomy = PublicRef & { description: string; image: string | null };
export type PublicCategory = PublicTaxonomy & { subcategories: PublicTaxonomy[] };
export type PublicSubcategory = PublicTaxonomy & { category: PublicRef };

export type PublicStoreInfo = {
  storeName: string;
  tagline: string;
  contact: { email: string; phone: string; whatsapp: string };
  address: { line1: string; line2: string; city: string; state: string; postalCode: string; country: string };
  social: { instagram: string; facebook: string; youtube: string; pinterest: string };
};

export type Paginated<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type PublicProductSort = "newest" | "price_asc" | "price_desc" | "name_asc" | "name_desc" | "featured";
