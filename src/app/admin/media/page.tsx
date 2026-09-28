import type { Metadata } from "next";
import { ImageIcon } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { listMedia } from "@/lib/services/media";
import { PageHeader } from "@/components/admin/shared/page-header";
import { EmptyState } from "@/components/admin/shared/empty-state";
import { Pagination } from "@/components/admin/shared/pagination";
import { MediaLibrary } from "@/components/admin/media/media-library";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage(props: PageProps<"/admin/media">) {
  const admin = await requireAdminPage("media:read");
  const sp = await props.searchParams;
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const result = await listMedia({ page, pageSize: 36 });
  const canUpload = hasPermission(admin.role, "media:write");

  return (
    <>
      <PageHeader title="Media" description="Uploaded images. Files are stored in object storage; the database only keeps references." />
      {result.total === 0 ? (
        <>
          <MediaLibrary items={[]} canUpload={canUpload} canDelete={false} />
          <EmptyState icon={ImageIcon} title="No images yet" description="Upload product photos here or directly from a product." />
        </>
      ) : (
        <>
          <MediaLibrary
            items={result.items.map((m) => ({
              id: m.id,
              url: m.url,
              filename: m.filename,
              size: m.size,
              createdAt: m.createdAt.toISOString(),
              usage: m._count.productImages,
            }))}
            canUpload={canUpload}
            canDelete={hasPermission(admin.role, "media:delete")}
          />
          {result.totalPages > 1 && (
            <div className="mt-4 rounded-xl border bg-card">
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                total={result.total}
                pageSize={result.pageSize}
                hrefFor={(p) => `/admin/media?page=${p}`}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
