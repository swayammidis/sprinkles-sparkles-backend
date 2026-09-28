import { adminRoute, readJson } from "@/lib/api/admin-route";
import { createProduct, listProducts } from "@/lib/services/products";
import { productInputSchema, productListQuerySchema } from "@/lib/validations/product";

export const GET = adminRoute("catalog:read", async (req) => {
  const query = productListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return listProducts(query);
});

export const POST = adminRoute("catalog:write", async (req) => {
  const input = productInputSchema.parse(await readJson(req));
  const product = await createProduct(input);
  return Response.json({ id: product.id }, { status: 201 });
});
