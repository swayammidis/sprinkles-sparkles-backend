import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { listTaxonomy } from "@/lib/services/taxonomy";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/taxonomy";
import type { TaxonomyKind } from "@/lib/validations/catalog";
import { PageHeader } from "@/components/admin/shared/page-header";
import { TaxonomyManager, type TaxonomyConfig } from "@/components/admin/catalog/taxonomy-manager";

const CONFIG: Record<TaxonomyKind, Omit<TaxonomyConfig, "kind"> & { description: string }> = {
  categories: {
    singular: "Category",
    plural: "Categories",
    imageLabel: "Image",
    ordered: true,
    description: "The main sections of your shop, e.g. Sprinkles or Baking Tins.",
    emptyText: "Create your first category to organize your products.",
    namePlaceholder: "e.g. Sprinkles",
    descriptionPlaceholder: "e.g. Colourful sprinkles and decorative toppings for cakes, cupcakes and desserts.",
  },
  subcategories: {
    singular: "Subcategory",
    plural: "Subcategories",
    imageLabel: "Image",
    ordered: true,
    description: "Smaller groups inside a category, e.g. Cake Boxes inside Boxes & Packaging.",
    emptyText: "Add subcategories to organize products inside a category.",
    namePlaceholder: "e.g. Cake Boxes",
    descriptionPlaceholder: "A short description of this group.",
  },
  collections: {
    singular: "Collection",
    plural: "Collections",
    imageLabel: "Banner",
    ordered: true,
    description: "Curated groups of products, e.g. Diwali Collection or New Arrivals.",
    emptyText: "Create collections to highlight products for seasons and campaigns.",
    namePlaceholder: "e.g. Diwali Collection",
    descriptionPlaceholder: "What's special about this collection?",
  },
  occasions: {
    singular: "Occasion",
    plural: "Occasions",
    imageLabel: "Image",
    ordered: true,
    description: "Help customers shop by occasion, e.g. Birthday, Rakhi or Corporate Gifting.",
    emptyText: "Add occasions like Birthday or Diwali so customers can shop by event.",
    namePlaceholder: "e.g. Birthday",
    descriptionPlaceholder: "A short description for this occasion.",
  },
  brands: {
    singular: "Brand",
    plural: "Brands",
    imageLabel: "Logo",
    ordered: false,
    description: "Manufacturers of the products you sell. Products can optionally have a brand.",
    emptyText: "Add the brands you stock, so customers can shop by brand.",
    namePlaceholder: "e.g. Wilton",
    descriptionPlaceholder: "A short description of the brand.",
  },
};

/** Server component shared by the five catalog-organisation pages. */
export async function TaxonomyPage({ kind, categoryId, startWithNew }: { kind: TaxonomyKind; categoryId?: string; startWithNew?: boolean }) {
  const admin = await requireAdminPage("catalog:read");
  const cfg = CONFIG[kind];
  await connectDB();
  const [items, categories] = await Promise.all([
    listTaxonomy(kind, { categoryId }),
    kind === "subcategories"
      ? Category.find().select("name").sort({ sortOrder: 1, name: 1 }).lean().then((r) => r.map((c) => ({ id: String(c._id), name: c.name })))
      : Promise.resolve([]),
  ]);
  const canWrite = hasPermission(admin.role, "catalog:write");
  return (
    <>
      <PageHeader title={cfg.plural} description={cfg.description} />
      <TaxonomyManager
        config={{ kind, ...cfg }}
        items={items}
        categories={categories}
        categoryFilter={categoryId}
        canWrite={canWrite}
        canDelete={hasPermission(admin.role, "catalog:delete")}
        startWithNew={!!startWithNew && canWrite}
      />
    </>
  );
}
