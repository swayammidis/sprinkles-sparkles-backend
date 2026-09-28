import { catalogGet } from "./client";
import { mapProduct, mapProductSummary } from "./mappers";
import type { Paginated, PublicProductDetail, PublicProductSort, PublicProductSummary } from "./api-types";
import type { Page, Product, ProductSummary } from "@/types/product";

export type ProductQuery = {
  search?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  collection?: string;
  occasion?: string;
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  onSale?: boolean;
  inStock?: boolean;
  /** Rupees as decimal strings, e.g. "499" */
  minPrice?: string;
  maxPrice?: string;
  sort?: PublicProductSort;
  page?: number;
  pageSize?: number;
};

export function toPage(p: Paginated<PublicProductSummary>): Page<ProductSummary> {
  return { items: p.items.map(mapProductSummary), ...p.pagination };
}

const EMPTY: Page<ProductSummary> = { items: [], page: 1, pageSize: 0, total: 0, totalPages: 1 };

export async function getProducts(query: ProductQuery = {}): Promise<Page<ProductSummary>> {
  const data = await catalogGet<Paginated<PublicProductSummary>>("/products", query);
  return data ? toPage(data) : EMPTY;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const data = await catalogGet<PublicProductDetail>(`/products/${encodeURIComponent(slug)}`);
  return data ? mapProduct(data) : null;
}

export const getFeaturedProducts = (pageSize = 8) => getProducts({ featured: true, pageSize, sort: "newest" });
export const getNewArrivals = (pageSize = 8) => getProducts({ newArrival: true, pageSize, sort: "newest" });
export const getBestSellers = (pageSize = 8) => getProducts({ bestSeller: true, pageSize });
export const searchProducts = (search: string, query: Omit<ProductQuery, "search"> = {}) =>
  getProducts({ ...query, search });
