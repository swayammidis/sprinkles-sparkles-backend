import { adminRoute } from "@/lib/api/admin-route";
import { readJson } from "@/lib/api/request";
import { createProduct, listProducts } from "@/lib/services/products";
import { productInputSchema, productListQuerySchema } from "@/lib/validations/catalog";

/** Paginated, filtered, sorted product list (server-side). */
export const GET = adminRoute("catalog:read", async (req) =>
  listProducts(productListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))),
);

export const POST = adminRoute("catalog:write", async (req) => {
  const input = productInputSchema.parse((await readJson(req, 512_000)) ?? {});
  return Response.json(await createProduct(input), { status: 201 });
});
