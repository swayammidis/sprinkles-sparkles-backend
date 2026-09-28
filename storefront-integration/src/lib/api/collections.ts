import { catalogGet } from "./client";
import { toPage, type ProductQuery } from "./products";
import type { Paginated, PublicBrand, PublicCollection, PublicOccasion, PublicProductSummary } from "./api-types";

export async function getCollections(): Promise<PublicCollection[]> {
  return (await catalogGet<PublicCollection[]>("/collections", undefined, 300)) ?? [];
}

export async function getCollectionProducts(slug: string, query: Omit<ProductQuery, "collection"> = {}) {
  const data = await catalogGet<{ collection: PublicCollection; products: Paginated<PublicProductSummary> }>(
    `/collections/${encodeURIComponent(slug)}/products`,
    query,
  );
  return data ? { collection: data.collection, products: toPage(data.products) } : null;
}

export async function getOccasions(): Promise<PublicOccasion[]> {
  return (await catalogGet<PublicOccasion[]>("/occasions", undefined, 300)) ?? [];
}

export async function getOccasionProducts(slug: string, query: Omit<ProductQuery, "occasion"> = {}) {
  const data = await catalogGet<{ occasion: PublicOccasion; products: Paginated<PublicProductSummary> }>(
    `/occasions/${encodeURIComponent(slug)}/products`,
    query,
  );
  return data ? { occasion: data.occasion, products: toPage(data.products) } : null;
}

export async function getBrands(): Promise<PublicBrand[]> {
  return (await catalogGet<PublicBrand[]>("/brands", undefined, 300)) ?? [];
}
