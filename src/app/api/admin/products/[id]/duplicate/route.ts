import { adminRoute } from "@/lib/api/admin-route";
import { duplicateProduct } from "@/lib/services/products";

/** Copies a product as a new draft (without SKUs). */
export const POST = adminRoute<{ id: string }>("catalog:write", async (_req, { params }) =>
  Response.json(await duplicateProduct(params.id), { status: 201 }),
);
