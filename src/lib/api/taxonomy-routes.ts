import "server-only";
import { adminRoute, readJson } from "@/lib/api/admin-route";
import { reorderSchema, taxonomyInputSchema, taxonomyPatchSchema, type TaxonomyKind } from "@/lib/validations/taxonomy";
import {
  createTaxonomy,
  deleteTaxonomy,
  getTaxonomy,
  listTaxonomy,
  reorderTaxonomy,
  setTaxonomyActive,
  updateTaxonomy,
} from "@/lib/services/taxonomy";

/** Route handlers shared by categories, subcategories, brands, collections and occasions. */
export function taxonomyCollectionRoutes(kind: TaxonomyKind) {
  return {
    GET: adminRoute("catalog:read", async (req) => {
      const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
      return { items: await listTaxonomy(kind, { categoryId }) };
    }),
    POST: adminRoute("catalog:write", async (req) => {
      const input = taxonomyInputSchema.parse(await readJson(req));
      return Response.json({ item: await createTaxonomy(kind, input) }, { status: 201 });
    }),
  };
}

export function taxonomyItemRoutes(kind: TaxonomyKind) {
  return {
    GET: adminRoute<{ id: string }>("catalog:read", async (_req, { params }) => ({
      item: await getTaxonomy(kind, params.id),
    })),
    PUT: adminRoute<{ id: string }>("catalog:write", async (req, { params }) => {
      const input = taxonomyInputSchema.parse(await readJson(req));
      return { item: await updateTaxonomy(kind, params.id, input) };
    }),
    PATCH: adminRoute<{ id: string }>("catalog:write", async (req, { params }) => {
      const { active } = taxonomyPatchSchema.parse(await readJson(req));
      return { item: await setTaxonomyActive(kind, params.id, active) };
    }),
    DELETE: adminRoute<{ id: string }>("catalog:delete", async (_req, { params }) => {
      await deleteTaxonomy(kind, params.id);
      return { ok: true };
    }),
  };
}

export function taxonomyReorderRoute(kind: TaxonomyKind) {
  return adminRoute("catalog:write", async (req) => {
    const { ids } = reorderSchema.parse(await readJson(req));
    await reorderTaxonomy(kind, ids);
    return { ok: true };
  });
}
