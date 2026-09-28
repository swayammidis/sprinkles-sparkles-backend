"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Copy, ImageIcon, Loader2, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, errorMessage } from "@/lib/utils/api-client";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/admin/shared/confirm-dialog";
import { EmptyState } from "@/components/admin/shared/empty-state";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { ACCEPTED_IMAGE_TYPES, uploadImageFile, type UploadedImage } from "@/components/admin/media/upload";

export function MediaLibrary({ items, total, canUpload, canDelete }: { items: UploadedImage[]; total: number; canUpload: boolean; canDelete: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [deleting, setDeleting] = useState<UploadedImage | null>(null);
  const [q, setQ] = useState(params.get("q") ?? "");
  const lastQ = useRef(params.get("q") ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (q === lastQ.current) return;
    const t = setTimeout(() => {
      lastQ.current = q;
      startTransition(() => router.replace(q.trim() ? `${pathname}?q=${encodeURIComponent(q.trim())}` : pathname, { scroll: false }));
    }, 350);
    return () => clearTimeout(t);
  }, [q, pathname, router]);

  const onFiles = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setUploading(list.length);
    let ok = 0;
    for (const f of list) {
      try {
        await uploadImageFile(f, "misc");
        ok++;
      } catch (e) {
        toast.error(`${f.name}: ${errorMessage(e)}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    if (ok) toast.success(ok === 1 ? "Image uploaded." : `${ok} images uploaded.`);
    startTransition(() => router.refresh());
  };

  return (
    <div
      onDragOver={(e) => {
        if (canUpload && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!canUpload || !e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragOver(false);
        void onFiles(e.dataTransfer.files);
      }}
      className={cn("rounded-xl transition", dragOver && "ring-2 ring-primary ring-offset-4 ring-offset-background")}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by file name…" className="h-10 pl-9" aria-label="Search images" />
          {pending && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        {canUpload && (
          <>
            <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFiles(e.target.files)} />
            <Button className="h-10" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
              {uploading > 0 ? <Loader2 className="animate-spin" /> : <Upload />}
              {uploading > 0 ? `Uploading ${uploading}…` : "Upload images"}
            </Button>
          </>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={params.get("q") ? "No images match your search" : "No images yet"}
          description={params.get("q") ? "Try a different file name." : "Upload product photos here, or add them directly while creating a product. You can also drag files onto this page."}
          action={
            canUpload &&
            !params.get("q") && (
              <Button className="h-10" onClick={() => fileRef.current?.click()}>
                <Upload /> Upload images
              </Button>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {total} image{total === 1 ? "" : "s"}. Images that are in use can&apos;t be deleted until you remove them from the product or category.
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" aria-label="Images">
            {items.map((img) => (
              <li key={img.id} className="overflow-hidden rounded-xl border bg-card">
                <div className="aspect-square bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.filename} className="size-full object-cover" loading="lazy" />
                </div>
                <div className="space-y-1.5 p-2.5">
                  <p className="truncate text-xs font-medium" title={img.filename}>
                    {img.filename}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {img.width && img.height ? `${img.width} × ${img.height} · ` : ""}
                    {formatBytes(img.size)}
                    {img.createdAt ? ` · ${formatDate(img.createdAt)}` : ""}
                  </p>
                  <div className="flex items-center justify-between gap-1">
                    <StatusBadge tone={img.usage ? "turquoise" : "neutral"} dot={false}>
                      {img.usage ? `Used ${img.usage}×` : "Not used"}
                    </StatusBadge>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Copy link to ${img.filename}`}
                        onClick={async () => {
                          await navigator.clipboard.writeText(new URL(img.url, window.location.origin).toString());
                          toast.success("Image link copied.");
                        }}
                      >
                        <Copy />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          disabled={!!img.usage}
                          title={img.usage ? "In use: remove it from products first" : "Delete image"}
                          aria-label={img.usage ? `${img.filename} is in use and can't be deleted` : `Delete ${img.filename}`}
                          onClick={() => setDeleting(img)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this image?"
        description="The image will be permanently removed from your media library."
        confirmLabel="Delete image"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await apiFetch(`/api/admin/media/${deleting.id}`, { method: "DELETE" });
            toast.success("Image deleted.");
            startTransition(() => router.refresh());
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      />
    </div>
  );
}
