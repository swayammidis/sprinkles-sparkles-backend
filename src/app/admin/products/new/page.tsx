import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { taxonomyOptions } from "@/lib/services/taxonomy";
import { EMPTY_PRODUCT, ProductForm } from "@/components/admin/products/product-form";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const admin = await requireAdminPage("catalog:write");
  const options = await taxonomyOptions();
  return <ProductForm mode="create" initialValues={EMPTY_PRODUCT} options={options} canDelete={hasPermission(admin.role, "catalog:delete")} />;
}
