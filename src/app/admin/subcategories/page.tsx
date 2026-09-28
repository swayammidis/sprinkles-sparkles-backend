import type { Metadata } from "next";
import { TaxonomyPage } from "@/components/admin/categories/taxonomy-page";

export const metadata: Metadata = { title: "Subcategories" };

export default async function Page(props: PageProps<"/admin/subcategories">) {
  const { categoryId } = await props.searchParams;
  return <TaxonomyPage kind="subcategories" categoryId={typeof categoryId === "string" ? categoryId : undefined} />;
}
