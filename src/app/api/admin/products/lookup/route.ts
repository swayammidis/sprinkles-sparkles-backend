import { adminRoute } from "@/lib/api/admin-route";
import { searchProductsLite } from "@/lib/services/products";

/** Lightweight product search for pickers (e.g. adding products to a collection). */
export const GET = adminRoute("catalog:read", async (req) => ({
  products: await searchProductsLite((req.nextUrl.searchParams.get("q") ?? "").slice(0, 100)),
}));
