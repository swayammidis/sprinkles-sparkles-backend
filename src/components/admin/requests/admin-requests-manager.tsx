"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Clock, Loader2, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/lib/utils/api-client";
import { formatDateTime } from "@/lib/utils/format";
import type { AdminUserRow } from "@/lib/services/admin-users";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { StatusBadge } from "@/components/admin/shared/status-badge";

type DialogState =
  | { kind: "approve"; user: AdminUserRow }
  | { kind: "reject"; user: AdminUserRow }
  | null;

export function AdminRequestsManager({ initialRequests }: { initialRequests: AdminUserRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busy, setBusy] = useState(false);

  const closeDialog = () => !busy && setDialog(null);

  const handleApprove = async (user: AdminUserRow) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/requests/${user.id}/approve`, { method: "POST" });
      toast.success("Admin access approved successfully.");
      setDialog(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to approve admin request.");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (user: AdminUserRow) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/requests/${user.id}/reject`, { method: "POST" });
      toast.success("Admin request rejected.");
      setDialog(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to reject admin request.");
    } finally {
      setBusy(false);
    }
  };

  if (initialRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 p-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <UserCheck className="size-7" />
        </div>
        <h3 className="mt-4 text-base font-semibold">No pending admin requests</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          When new administrators register at /register, their requests will appear here for your approval.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View (md and up) */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Requested On</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialRequests.map((req) => (
              <TableRow key={req.id}>
                <TableCell className="font-medium text-foreground">{req.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{req.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(req.createdAt)}
                </TableCell>
                <TableCell>
                  <StatusBadge tone="warning">Pending</StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                      onClick={() => setDialog({ kind: "approve", user: req })}
                    >
                      <Check className="size-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDialog({ kind: "reject", user: req })}
                    >
                      <X className="size-3.5" /> Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile & Tablet Card View (below md) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {initialRequests.map((req) => (
          <Card key={req.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-foreground">{req.name}</h3>
                  <p className="truncate text-sm text-muted-foreground">{req.email}</p>
                </div>
                <StatusBadge tone="warning">Pending</StatusBadge>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 shrink-0" />
                <span>Requested {formatDateTime(req.createdAt)}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 pt-1 border-t">
                <Button
                  size="default"
                  className="h-10 w-full gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => setDialog({ kind: "approve", user: req })}
                >
                  <Check className="size-4" /> Approve
                </Button>
                <Button
                  size="default"
                  variant="outline"
                  className="h-10 w-full gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDialog({ kind: "reject", user: req })}
                >
                  <X className="size-4" /> Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Approve Confirmation Dialog */}
      {dialog?.kind === "approve" && (
        <AlertDialog open onOpenChange={(open) => !open && closeDialog()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-full bg-success-soft text-success sm:mx-0">
                <CheckCircle2 className="size-6" />
              </div>
              <AlertDialogTitle>Approve Admin Access?</AlertDialogTitle>
              <AlertDialogDescription>
                After approval, <span className="font-medium text-foreground">{dialog.user.name}</span> ({dialog.user.email}) will be able to sign in to the admin panel with administrative privileges.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy} onClick={closeDialog}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                className="bg-success text-success-foreground hover:bg-success/90"
                onClick={(e) => {
                  e.preventDefault();
                  handleApprove(dialog.user);
                }}
              >
                {busy && <Loader2 className="animate-spin" />} Approve
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Reject Confirmation Dialog */}
      {dialog?.kind === "reject" && (
        <AlertDialog open onOpenChange={(open) => !open && closeDialog()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject Admin Request?</AlertDialogTitle>
              <AlertDialogDescription>
                This will reject the admin request from <span className="font-medium text-foreground">{dialog.user.name}</span> ({dialog.user.email}). They will not be able to access the admin panel.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy} onClick={closeDialog}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  handleReject(dialog.user);
                }}
              >
                {busy && <Loader2 className="animate-spin" />} Reject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
