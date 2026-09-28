import { catalogGet } from "./client";
import { mapProduct, mapProductSummary } from "./mappers";
import type { Paginated, PublicProductDetail, PublicProductSort, PublicProductSummary } from "./api-types";
import type { Page, Product, ProductSummary } from "@/types/product";

export type ProductQuery = {
  search?: string;
  /** slugs */
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
  /** rupees, e.g. "499" */
  minPrice?: string;
  maxPrice?: string;
  sort?: PublicProductSort;
  page?: number;
  /** max 48 */
  pageSize?: number;
};

const EMPTY: Page<ProductSummary> = { items: [], page: 1, pageSize: 0, total: 0, totalPages: 1 };

export async function getProducts(query: ProductQuery = {}): Promise<Page<ProductSummary>> {
  const data = await catalogGet<Paginated<PublicProductSummary>>("/products", query);
  return data ? { items: data.items.map(mapProductSummary), ...data.pagination } : EMPTY;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const data = await catalogGet<PublicProductDetail>(`/products/${encodeURIComponent(slug)}`);
  return data ? mapProduct(data) : null;
}

export const getFeaturedProducts = (pageSize = 8) => getProducts({ featured: true, pageSize });
export const getNewArrivals = (pageSize = 8) => getProducts({ newArrival: true, pageSize });
export const getBestSellers = (pageSize = 8) => getProducts({ bestSeller: true, pageSize });
export const getProductsByCategory = (category: string, q: Omit<ProductQuery, "category"> = {}) => getProducts({ ...q, category });
export const getProductsBySubcategory = (subcategory: string, q: Omit<ProductQuery, "subcategory"> = {}) => getProducts({ ...q, subcategory });
export const getCollectionProducts = (collection: string, q: Omit<ProductQuery, "collection"> = {}) => getProducts({ ...q, collection });
export const getOccasionProducts = (occasion: string, q: Omit<ProductQuery, "occasion"> = {}) => getProducts({ ...q, occasion });
export const searchProducts = (search: string, q: Omit<ProductQuery, "search"> = {}) => getProducts({ ...q, search });
