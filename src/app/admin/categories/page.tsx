import type { Metadata } from "next";
import { TaxonomyPage } from "@/components/admin/catalog/taxonomy-page";

export const metadata: Metadata = { title: "Categories" };

export default async function Page(props: PageProps<"/admin/categories">) {
  const sp = await props.searchParams;
  return <TaxonomyPage kind="categories" startWithNew={sp.new === "1"} />;
}
