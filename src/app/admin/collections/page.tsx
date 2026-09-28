import type { Metadata } from "next";
import { TaxonomyPage } from "@/components/admin/catalog/taxonomy-page";

export const metadata: Metadata = { title: "Collections" };

export default async function Page(props: PageProps<"/admin/collections">) {
  const sp = await props.searchParams;
  return <TaxonomyPage kind="collections" startWithNew={sp.new === "1"} />;
}
