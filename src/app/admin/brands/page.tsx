import type { Metadata } from "next";
import { TaxonomyPage } from "@/components/admin/catalog/taxonomy-page";

export const metadata: Metadata = { title: "Brands" };

export default async function Page(props: PageProps<"/admin/brands">) {
  const sp = await props.searchParams;
  return <TaxonomyPage kind="brands" startWithNew={sp.new === "1"} />;
}
