import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { listMedia } from "@/lib/services/media";
import { PageHeader } from "@/components/admin/shared/page-header";
import { Pagination } from "@/components/admin/shared/pagination";
import { MediaLibrary } from "@/components/admin/media/media-library";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage(props: PageProps<"/admin/media">) {
  const admin = await requireAdminPage("media:read");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const result = await listMedia({ q, page, pageSize: 36 });

  return (
    <>
      <PageHeader title="Media" description="All your uploaded images in one place." />
      <MediaLibrary
        items={result.items}
        total={result.total}
        canUpload={hasPermission(admin.role, "media:write")}
        canDelete={hasPermission(admin.role, "media:delete")}
      />
      {result.totalPages > 1 && (
        <div className="mt-4 rounded-xl border bg-card">
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            noun="images"
            hrefFor={(p) => `/admin/media?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`}
          />
        </div>
      )}
    </>
  );
}
