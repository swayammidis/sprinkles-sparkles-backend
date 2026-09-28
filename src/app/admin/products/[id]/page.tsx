import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getProductForEdit, getProductFormOptions } from "@/lib/services/products";
import { ProductForm } from "@/components/admin/products/product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage(props: PageProps<"/admin/products/[id]">) {
  const admin = await requireAdminPage("catalog:read");
  const { id } = await props.params;
  const [product, options] = await Promise.all([getProductForEdit(id), getProductFormOptions()]);
  if (!product) notFound();

  return (
    <ProductForm
      key={product.id}
      mode="edit"
      productId={product.id}
      initialValues={product.values}
      initialSeoImageUrl={product.seoImageUrl}
      options={options}
      canDelete={hasPermission(admin.role, "catalog:delete")}
    />
  );
}
