import { z } from "zod";
import { MONEY_REGEX, SLUG_REGEX } from "@/lib/validations/common";

const slug = z.string().trim().max(140).regex(SLUG_REGEX).optional().catch(undefined);
const bool = z.enum(["true", "false"]).transform((v) => v === "true").optional().catch(undefined);
const money = z.string().trim().regex(MONEY_REGEX).optional().catch(undefined);

/** Lenient: invalid params are ignored instead of failing the storefront request. */
export const publicProductQuerySchema = z.object({
  search: z.string().trim().max(100).optional().catch(undefined),
  category: slug,
  subcategory: slug,
  brand: slug,
  collection: slug,
  occasion: slug,
  featured: bool,
  newArrival: bool,
  bestSeller: bool,
  onSale: bool,
  inStock: bool,
  minPrice: money,
  maxPrice: money,
  sort: z
    .enum(["newest", "price_asc", "price_desc", "name_asc", "name_desc", "featured"])
    .catch("newest")
    .default("newest"),
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).catch(24).default(24),
});

export type PublicProductQuery = z.infer<typeof publicProductQuerySchema>;
