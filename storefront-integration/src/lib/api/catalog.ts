import { catalogGet } from "./client";
import type { PublicCategory, PublicStoreInfo, PublicSubcategory, PublicTaxonomy } from "./api-types";

// Taxonomy changes rarely: cache for 5 minutes.
const TTL = 300;

export const getCategories = async () => (await catalogGet<PublicCategory[]>("/categories", undefined, TTL)) ?? [];
export const getCategory = (slug: string) => catalogGet<PublicCategory>(`/categories/${encodeURIComponent(slug)}`, undefined, TTL);

export const getSubcategories = async (categorySlug?: string) =>
  (await catalogGet<PublicSubcategory[]>("/subcategories", { category: categorySlug }, TTL)) ?? [];
export const getSubcategory = (slug: string) => catalogGet<PublicSubcategory>(`/subcategories/${encodeURIComponent(slug)}`, undefined, TTL);

export const getCollections = async () => (await catalogGet<PublicTaxonomy[]>("/collections", undefined, TTL)) ?? [];
export const getCollection = (slug: string) => catalogGet<PublicTaxonomy>(`/collections/${encodeURIComponent(slug)}`, undefined, TTL);

export const getOccasions = async () => (await catalogGet<PublicTaxonomy[]>("/occasions", undefined, TTL)) ?? [];
export const getOccasion = (slug: string) => catalogGet<PublicTaxonomy>(`/occasions/${encodeURIComponent(slug)}`, undefined, TTL);

export const getBrands = async () => (await catalogGet<PublicTaxonomy[]>("/brands", undefined, TTL)) ?? [];
export const getBrand = (slug: string) => catalogGet<PublicTaxonomy>(`/brands/${encodeURIComponent(slug)}`, undefined, TTL);

/** Store name, contact details, address and social links from the admin Settings page. */
export const getStoreInfo = () => catalogGet<PublicStoreInfo>("/store", undefined, TTL);
