"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type FieldValues, type Path, type UseFormSetError } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Power,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/lib/utils/api-client";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { ROLE_LABELS, ROLES } from "@/lib/auth/permissions";

import type { AdminUserRow } from "@/lib/services/admin-users";
import {
  adminCreateSchema,
  adminUpdateSchema,
  resetPasswordSchema,
  type AdminCreateInput,
  type AdminUpdateInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { PasswordInput } from "@/components/admin/auth/password-input";

type Dialogs =
  | { kind: "create" }
  | { kind: "edit"; user: AdminUserRow }
  | { kind: "password"; user: AdminUserRow }
  | { kind: "delete"; user: AdminUserRow }
  | { kind: "status"; user: AdminUserRow }
  | { kind: "approve"; user: AdminUserRow }
  | { kind: "reject"; user: AdminUserRow }
  | null;

type FilterTab = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "INACTIVE";

function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>) {
  if (err instanceof ApiClientError) {
    for (const [k, m] of Object.entries(err.fieldErrors)) setError(k as Path<T>, { message: m });
    toast.error(err.message);
  } else toast.error("Something went wrong.");
}

/** Random password that satisfies the policy (upper, lower, digit, symbol). Generated in the browser. */
function generatePassword(length = 16) {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%*-_=+"];
  const all = sets.join("");
  const rand = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const chars = sets.map((s) => s[rand(s.length)]);
  while (chars.length < length) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function Err({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function AdminUsersManager({ users, currentUserId }: { users: AdminUserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("ALL");

  const close = () => setDialog(null);
  const done = (message: string) => {
    toast.success(message);
    close();
    startTransition(() => router.refresh());
  };

  // Compute status category for a user
  const getUserStatusCategory = (u: AdminUserRow): "PENDING" | "APPROVED" | "REJECTED" | "INACTIVE" => {
    if (u.status === "PENDING") return "PENDING";
    if (u.status === "REJECTED") return "REJECTED";
    if (!u.isActive) return "INACTIVE";
    return "APPROVED";
  };

  // Filtered and searched users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Status filter
      if (filter !== "ALL") {
        const cat = getUserStatusCategory(u);
        if (cat !== filter) return false;
      }

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchesName = u.name.toLowerCase().includes(query);
        const matchesEmail = u.email.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail) return false;
      }

      return true;
    });
  }, [users, filter, search]);

  const counts = useMemo(() => {
    const res = { ALL: users.length, PENDING: 0, APPROVED: 0, REJECTED: 0, INACTIVE: 0 };
    for (const u of users) {
      const cat = getUserStatusCategory(u);
      res[cat]++;
    }
    return res;
  }, [users]);

  return (
    <>
      {/* Header controls: Search, Filters, Create Admin */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setDialog({ kind: "create" })} className="h-9">
            <UserPlus className="size-4" /> Create Admin
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b pb-3">
        {(
          [
            { id: "ALL", label: "All" },
            { id: "PENDING", label: "Pending" },
            { id: "APPROVED", label: "Approved" },
            { id: "REJECTED", label: "Rejected" },
            { id: "INACTIVE", label: "Inactive" },
          ] as const
        ).map((tab) => {
          const active = filter === tab.id;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background/80 text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No administrators found matching your filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const self = u.id === currentUserId;
                  const isPending = u.status === "PENDING";
                  const isRejected = u.status === "REJECTED";
                  const isApproved = u.status === "APPROVED" || !u.status;

                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.name} {self && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                      </TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell>
                        <StatusBadge tone={u.role === "SUPER_ADMIN" ? "pink" : "turquoise"} dot={false}>
                          {ROLE_LABELS[u.role]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {isPending && <StatusBadge tone="warning">Pending</StatusBadge>}
                        {isRejected && <StatusBadge tone="danger">Rejected</StatusBadge>}
                        {isApproved && (
                          <StatusBadge tone={u.isActive ? "success" : "neutral"}>
                            {u.isActive ? "Approved" : "Inactive"}
                          </StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* Pending actions */}
                            {isPending && (
                              <>
                                <DropdownMenuItem onSelect={() => setDialog({ kind: "approve", user: u })}>
                                  <Check className="size-4 text-success" /> Approve Request
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDialog({ kind: "reject", user: u })}>
                                  <X className="size-4 text-destructive" /> Reject Request
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}

                            {/* Rejected actions */}
                            {isRejected && (
                              <>
                                <DropdownMenuItem onSelect={() => setDialog({ kind: "approve", user: u })}>
                                  <Check className="size-4 text-success" /> Approve Account
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}

                            {/* Edit */}
                            <DropdownMenuItem onSelect={() => setDialog({ kind: "edit", user: u })}>
                              <Pencil /> Edit
                            </DropdownMenuItem>

                            {/* Activate / Deactivate (only for approved accounts) */}
                            {isApproved && (
                              <DropdownMenuItem disabled={self} onSelect={() => setDialog({ kind: "status", user: u })}>
                                <Power /> {u.isActive ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                            )}

                            {/* Reset password */}
                            <DropdownMenuItem onSelect={() => setDialog({ kind: "password", user: u })}>
                              <KeyRound /> Reset password
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Delete (prevent self-deletion) */}
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={self}
                              onSelect={() => setDialog({ kind: "delete", user: u })}
                            >
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {dialog?.kind === "create" && <CreateDialog onClose={close} onDone={done} />}
      {dialog?.kind === "edit" && (
        <EditDialog user={dialog.user} self={dialog.user.id === currentUserId} onClose={close} onDone={done} />
      )}
      {dialog?.kind === "password" && <PasswordDialog user={dialog.user} onClose={close} onDone={done} />}
      {dialog?.kind === "approve" && (
        <ConfirmAction
          title={`Approve Admin Access for ${dialog.user.name}?`}
          description="After approval, this user will be able to sign in to the admin panel."
          confirmLabel="Approve"
          onClose={close}
          onConfirm={async () => {
            await apiFetch(`/api/admin/requests/${dialog.user.id}/approve`, { method: "POST" });
            done("Admin access approved successfully.");
          }}
        />
      )}
      {dialog?.kind === "reject" && (
        <ConfirmAction
          title={`Reject Admin Request for ${dialog.user.name}?`}
          description="This user will not be able to access the admin panel."
          confirmLabel="Reject"
          destructive
          onClose={close}
          onConfirm={async () => {
            await apiFetch(`/api/admin/requests/${dialog.user.id}/reject`, { method: "POST" });
            done("Admin request rejected.");
          }}
        />
      )}
      {dialog?.kind === "status" && (
        <ConfirmAction
          title={dialog.user.isActive ? `Deactivate ${dialog.user.name}?` : `Activate ${dialog.user.name}?`}
          description={
            dialog.user.isActive
              ? "They will be signed out immediately and won't be able to sign in until reactivated."
              : "They will be able to sign in again."
          }
          confirmLabel={dialog.user.isActive ? "Deactivate" : "Activate"}
          destructive={dialog.user.isActive}
          onClose={close}
          onConfirm={async () => {
            await apiFetch(`/api/admin/users/${dialog.user.id}/status`, {
              method: "PATCH",
              body: { isActive: !dialog.user.isActive },
            });
            done(dialog.user.isActive ? "Admin deactivated" : "Admin activated");
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmAction
          title={`Delete ${dialog.user.name}?`}
          description="This permanently removes the admin account and signs them out. This cannot be undone. Deactivating instead keeps their record."
          confirmLabel="Delete"
          destructive
          onClose={close}
          onConfirm={async () => {
            await apiFetch(`/api/admin/users/${dialog.user.id}`, { method: "DELETE" });
            done("Admin deleted");
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Choose a role" />
      </SelectTrigger>
      <SelectContent position="popper">
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {r === "SUPER_ADMIN" ? "Super Admin: full access incl. admin users" : "Admin: catalog management"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: (m: string) => void }) {
  const [confirmSuper, setConfirmSuper] = useState<AdminCreateInput | null>(null);
  const form = useForm<AdminCreateInput>({
    resolver: zodResolver(adminCreateSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", role: "ADMIN" },
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const e = formState.errors;

  const create = async (values: AdminCreateInput) => {
    try {
      await apiFetch("/api/admin/users", { method: "POST", body: values });
      onDone(`${values.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"} created`);
    } catch (err) {
      setConfirmSuper(null);
      applyServerErrors(err, setError);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    // Creating a SUPER_ADMIN needs an explicit second confirmation.
    if (values.role === "SUPER_ADMIN") setConfirmSuper(values);
    else await create(values);
  });

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create admin</DialogTitle>
            <DialogDescription>Share the password with them securely. They can sign in immediately.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" aria-invalid={!!e.name} {...register("name")} />
              <Err message={e.name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" autoComplete="off" aria-invalid={!!e.email} {...register("email")} />
              <Err message={e.email?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-password">Password</Label>
              <PasswordInput id="c-password" autoComplete="new-password" aria-invalid={!!e.password} {...register("password")} />
              <Err message={e.password?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-confirm">Confirm password</Label>
              <PasswordInput id="c-confirm" autoComplete="new-password" aria-invalid={!!e.confirmPassword} {...register("confirmPassword")} />
              <Err message={e.confirmPassword?.message} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Controller control={control} name="role" render={({ field }) => <RoleSelect value={field.value} onChange={field.onChange} />} />
              <Err message={e.role?.message} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={formState.isSubmitting}>
                {formState.isSubmitting && <Loader2 className="animate-spin" />} Create admin
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {confirmSuper && (
        <ConfirmAction
          title="Create another Super Admin?"
          description={`${confirmSuper.email} will have full access, including managing all admin accounts and security settings.`}
          confirmLabel="Yes, create Super Admin"
          onClose={() => setConfirmSuper(null)}
          onConfirm={() => create(confirmSuper)}
        />
      )}
    </>
  );
}

function EditDialog({
  user,
  self,
  onClose,
  onDone,
}: {
  user: AdminUserRow;
  self: boolean;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const form = useForm<AdminUpdateInput>({
    resolver: zodResolver(adminUpdateSchema),
    defaultValues: { name: user.name, email: user.email, role: user.role },
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const e = formState.errors;
  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/admin/users/${user.id}`, { method: "PATCH", body: values });
      onDone("Admin updated");
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit admin</DialogTitle>
          <DialogDescription>Changing the role signs this admin out so the new permissions apply immediately.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Name</Label>
            <Input id="e-name" aria-invalid={!!e.name} {...register("name")} />
            <Err message={e.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-email">Email</Label>
            <Input id="e-email" type="email" aria-invalid={!!e.email} {...register("email")} />
            <Err message={e.email?.message} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => <RoleSelect value={field.value} onChange={field.onChange} disabled={self} />}
            />
            {self && <p className="text-xs text-muted-foreground">You can&apos;t change your own role.</p>}
            <Err message={e.role?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [generated, setGenerated] = useState<string | null>(null);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { register, handleSubmit, setValue, setError, formState } = form;
  const e = formState.errors;

  const generate = () => {
    const pw = generatePassword();
    setGenerated(pw);
    setValue("password", pw, { shouldValidate: true });
    setValue("confirmPassword", pw, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/admin/users/${user.id}/password`, { method: "POST", body: values });
      onDone(`Password reset for ${user.name}. They have been signed out.`);
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password: {user.name}</DialogTitle>
          <DialogDescription>
            Set a new password. The current password is never shown. {user.name} will be signed out everywhere.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <Button type="button" variant="outline" size="sm" onClick={generate}>
            <RefreshCw /> Generate strong password
          </Button>
          {generated && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
              <code className="flex-1 truncate font-mono text-sm">{generated}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Copy password"
                onClick={async () => {
                  await navigator.clipboard.writeText(generated);
                  toast.success("Copied. Share it securely.");
                }}
              >
                <Copy />
              </Button>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="r-password">New password</Label>
            <PasswordInput id="r-password" autoComplete="new-password" aria-invalid={!!e.password} {...register("password")} />
            <Err message={e.password?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-confirm">Confirm new password</Label>
            <PasswordInput id="r-confirm" autoComplete="new-password" aria-invalid={!!e.confirmPassword} {...register("confirmPassword")} />
            <Err message={e.confirmPassword?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting && <Loader2 className="animate-spin" />} Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmAction({
  title,
  description,
  confirmLabel,
  destructive = false,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            disabled={busy}
            onClick={async (ev) => {
              ev.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
              } catch (err) {
                toast.error(err instanceof ApiClientError ? err.message : "Something went wrong.");
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />} {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
