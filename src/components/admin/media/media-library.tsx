"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/lib/utils/api-client";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/shared/confirm-dialog";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { ACCEPTED_IMAGE_TYPES, uploadImageFile } from "@/components/admin/media/upload";

type Item = { id: string; url: string; filename: string; size: number; createdAt: string; usage: number };

export function MediaLibrary({ items, canUpload, canDelete }: { items: Item[]; canUpload: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [uploading, setUploading] = useState(0);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setUploading(list.length);
    for (const f of list) {
      try {
        await uploadImageFile(f, "misc");
      } catch (e) {
        toast.error(`${f.name}: ${e instanceof ApiClientError ? e.message : "upload failed"}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    startTransition(() => router.refresh());
  };

  return (
    <>
      {canUpload && (
        <div className="mb-4 flex justify-end">
          <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? <Loader2 className="animate-spin" /> : <Upload />}
            {uploading > 0 ? `Uploading ${uploading}…` : "Upload images"}
          </Button>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {items.map((item) => (
          <li key={item.id} className="overflow-hidden rounded-xl border bg-card">
            <div className="aspect-square bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.filename} className="size-full object-cover" loading="lazy" />
            </div>
            <div className="space-y-1.5 p-2.5">
              <p className="truncate text-xs font-medium" title={item.filename}>
                {item.filename}
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{formatBytes(item.size)}</span>
                <span>{formatDate(item.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <StatusBadge tone={item.usage ? "turquoise" : "neutral"} dot={false}>
                  {item.usage ? `Used ×${item.usage}` : "Unused"}
                </StatusBadge>
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copy URL"
                    onClick={async () => {
                      await navigator.clipboard.writeText(new URL(item.url, window.location.origin).toString());
                      toast.success("URL copied");
                    }}
                  >
                    <Copy />
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon-xs" className="text-destructive" aria-label="Delete" onClick={() => setDeleting(item)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete image?"
        description="The file is removed from storage. Images still used by products or categories cannot be deleted."
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await apiFetch(`/api/admin/media/${deleting.id}`, { method: "DELETE" });
            toast.success("Image deleted");
            startTransition(() => router.refresh());
          } catch (e) {
            toast.error(e instanceof ApiClientError ? e.message : "Delete failed");
            throw e;
          }
        }}
      />
    </>
  );
}
