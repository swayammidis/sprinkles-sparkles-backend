"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/lib/utils/api-client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/admin/shared/confirm-dialog";

const errMsg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong");

export function FeaturedToggle({ id, featured, disabled }: { id: string; featured: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(featured);
  const [pending, startTransition] = useTransition();
  return (
    <Switch
      checked={value}
      disabled={disabled || pending}
      aria-label="Featured"
      onCheckedChange={async (checked) => {
        setValue(checked);
        try {
          await apiFetch(`/api/admin/products/${id}`, { method: "PATCH", body: { featured: checked } });
          startTransition(() => router.refresh());
        } catch (e) {
          setValue(!checked);
          toast.error(errMsg(e));
        }
      }}
    />
  );
}

export function ProductRowActions({
  id,
  name,
  active,
  canWrite,
  canDelete,
}: {
  id: string;
  name: string;
  active: boolean;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const togglePublish = async () => {
    try {
      await apiFetch(`/api/admin/products/${id}`, { method: "PATCH", body: { active: !active } });
      toast.success(active ? "Product unpublished" : "Product published");
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const duplicate = async () => {
    try {
      const res = await apiFetch<{ id: string }>(`/api/admin/products/${id}/duplicate`, { method: "POST" });
      toast.success("Duplicated as a draft");
      router.push(`/admin/products/${res.id}`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
                {active ? <EyeOff /> : <Eye />} {active ? "Unpublish" : "Publish"}
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
        title="Delete product?"
        description={
          <>
            <strong>{name}</strong> and its variants will be permanently deleted. Uploaded images stay in the media
            library. Consider unpublishing instead if you may need it again.
          </>
        }
        onConfirm={async () => {
          try {
            await apiFetch(`/api/admin/products/${id}`, { method: "DELETE" });
            toast.success("Product deleted");
            refresh();
          } catch (e) {
            toast.error(errMsg(e));
            throw e;
          }
        }}
      />
    </>
  );
}
