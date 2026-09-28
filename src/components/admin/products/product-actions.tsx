"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, errorMessage } from "@/lib/utils/api-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/admin/shared/confirm-dialog";

/** Star button that toggles "Featured" in place. */
export function FeaturedToggle({ id, name, featured, disabled }: { id: string; name: string; featured: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(featured);
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled || pending}
      aria-pressed={value}
      aria-label={value ? `${name} is featured. Remove from featured` : `Mark ${name} as featured`}
      title={value ? "Featured" : "Not featured"}
      onClick={async () => {
        const next = !value;
        setValue(next);
        try {
          await apiFetch(`/api/admin/products/${id}`, { method: "PATCH", body: { featured: next } });
          toast.success(next ? "Marked as featured." : "Removed from featured.");
          startTransition(() => router.refresh());
        } catch (e) {
          setValue(!next);
          toast.error(errorMessage(e));
        }
      }}
    >
      <Star className={cn(value ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
    </Button>
  );
}

export function ProductActions({
  id,
  name,
  status,
  canWrite,
  canDelete,
}: {
  id: string;
  name: string;
  status: "draft" | "published";
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const togglePublish = async () => {
    try {
      await apiFetch(`/api/admin/products/${id}`, { method: "PATCH", body: { status: status === "published" ? "draft" : "published" } });
      toast.success(status === "published" ? "Product moved to drafts." : "Product published.");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const duplicate = async () => {
    try {
      const res = await apiFetch<{ id: string }>(`/api/admin/products/${id}/duplicate`, { method: "POST" });
      toast.success("Product duplicated as a new draft. Add a SKU before publishing it.");
      router.push(`/admin/products/${res.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`More actions for ${name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/admin/products/${id}`}>
              <Pencil /> Edit
            </Link>
          </DropdownMenuItem>
          {canWrite && (
            <>
              <DropdownMenuItem onSelect={duplicate}>
                <Copy /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={togglePublish}>
                {status === "published" ? <EyeOff /> : <Eye />} {status === "published" ? "Unpublish" : "Publish"}
              </DropdownMenuItem>
            </>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this product?"
        description={
          <>
            <p>
              This action will remove <strong>{name}</strong> from your catalog. It can&apos;t be undone.
            </p>
            {status === "published" && <p className="mt-2">Tip: choose <strong>Unpublish</strong> instead to hide it but keep it.</p>}
          </>
        }
        confirmLabel="Delete product"
        onConfirm={async () => {
          try {
            await apiFetch(`/api/admin/products/${id}`, { method: "DELETE" });
            toast.success("Product deleted.");
            refresh();
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      />
    </>
  );
}
