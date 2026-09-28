import type { Metadata } from "next";
import { TaxonomyPage } from "@/components/admin/catalog/taxonomy-page";

export const metadata: Metadata = { title: "Subcategories" };

export default async function Page(props: PageProps<"/admin/subcategories">) {
  const sp = await props.searchParams;
  const categoryId = typeof sp.category === "string" ? sp.category : undefined;
  return <TaxonomyPage kind="subcategories" categoryId={categoryId} startWithNew={sp.new === "1"} />;
}
