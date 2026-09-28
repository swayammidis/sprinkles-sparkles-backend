import type { Metadata } from "next";
import { TaxonomyPage } from "@/components/admin/catalog/taxonomy-page";

export const metadata: Metadata = { title: "Occasions" };

export default async function Page(props: PageProps<"/admin/occasions">) {
  const sp = await props.searchParams;
  return <TaxonomyPage kind="occasions" startWithNew={sp.new === "1"} />;
}
