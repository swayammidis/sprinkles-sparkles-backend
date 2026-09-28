"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/lib/utils/api-client";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/permissions";
import { adminUserCreateSchema } from "@/lib/validations/admin-user";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError, FieldHint } from "@/components/admin/products/field";

type AdminUser = { id: string; name: string; email: string; role: Role; active: boolean; createdAt: string };
type CreateValues = z.infer<typeof adminUserCreateSchema>;

export function AdminUsers({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const patch = async (id: string, body: Partial<Pick<AdminUser, "role" | "active">>) => {
    setBusy(id);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body });
      toast.success("Admin updated");
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const form = useForm<CreateValues>({
    resolver: zodResolver(adminUserCreateSchema),
    defaultValues: { name: "", email: "", password: "", role: "ADMIN" },
  });
  const onCreate = form.handleSubmit(async (values) => {
    try {
      await apiFetch("/api/admin/users", { method: "POST", body: values });
      toast.success("Admin created. Share the temporary password securely.");
      form.reset();
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      if (e instanceof ApiClientError) {
        for (const [k, m] of Object.entries(e.fieldErrors)) form.setError(k as FieldPath<CreateValues>, { message: m[0] });
        if (!Object.keys(e.fieldErrors).length) toast.error(e.message);
      }
    }
  });

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <UserPlus /> Add admin
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const self = u.id === currentUserId;
              return (
                <TableRow key={u.id} className={busy === u.id ? "opacity-60" : undefined}>
                  <TableCell>
                    <div className="font-medium">
                      {u.name} {self && <span className="text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Select value={u.role} disabled={self || busy === u.id} onValueChange={(v) => patch(u.id, { role: v as Role })}>
                      <SelectTrigger className="h-8 w-36" aria-label={`Role for ${u.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.active}
                      disabled={self || busy === u.id}
                      onCheckedChange={(v) => patch(u.id, { active: v })}
                      aria-label={`${u.name} active`}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add admin</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="au-name">Name</Label>
              <Input id="au-name" aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="au-email">Email</Label>
              <Input id="au-email" type="email" aria-invalid={!!form.formState.errors.email} {...form.register("email")} />
              <FieldError message={form.formState.errors.email?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="au-password">Temporary password</Label>
              <Input id="au-password" type="password" autoComplete="new-password" aria-invalid={!!form.formState.errors.password} {...form.register("password")} />
              <FieldError message={form.formState.errors.password?.message} />
              <FieldHint>Ask them to change it from Settings after first sign-in.</FieldHint>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="ADMIN">Admin — catalog management</SelectItem>
                      <SelectItem value="SUPER_ADMIN">Super Admin — everything</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Create admin
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
