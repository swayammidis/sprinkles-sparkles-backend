import { catalogGet } from "./client";
import { toPage, type ProductQuery } from "./products";
import type { Paginated, PublicCategory, PublicProductSummary } from "./api-types";

export async function getCategories(): Promise<PublicCategory[]> {
  return (await catalogGet<PublicCategory[]>("/categories", undefined, 300)) ?? [];
}

export async function getCategory(slug: string): Promise<PublicCategory | null> {
  return catalogGet<PublicCategory>(`/categories/${encodeURIComponent(slug)}`, undefined, 300);
}

export async function getCategoryProducts(slug: string, query: Omit<ProductQuery, "category"> = {}) {
  const data = await catalogGet<{ category: PublicCategory; products: Paginated<PublicProductSummary> }>(
    `/categories/${encodeURIComponent(slug)}/products`,
    query,
  );
  return data ? { category: data.category, products: toPage(data.products) } : null;
}

export async function getSubcategoryProducts(slug: string, query: Omit<ProductQuery, "subcategory"> = {}) {
  const data = await catalogGet<{
    subcategory: { name: string; slug: string; description: string | null; image: string | null; category: { name: string; slug: string } };
    products: Paginated<PublicProductSummary>;
  }>(`/subcategories/${encodeURIComponent(slug)}/products`, query);
  return data ? { subcategory: data.subcategory, products: toPage(data.products) } : null;
}
