import type { Metadata } from "next";
import { TaxonomyPage } from "@/components/admin/categories/taxonomy-page";

export const metadata: Metadata = { title: "Occasions" };

export default function Page() {
  return <TaxonomyPage kind="occasions" />;
}
