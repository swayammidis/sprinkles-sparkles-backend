"use client";

import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Header identity block: avatar, name, role and a logout button. */
export function UserMenu({ admin }: { admin: { name: string; email: string; role: Role } }) {
  const [pending, startTransition] = useTransition();
  const initials = admin.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2.5 border-l pl-3">
        <Avatar className="size-8">
          <AvatarFallback className="bg-brand-pink-soft text-xs font-semibold text-brand-pink">{initials}</AvatarFallback>
        </Avatar>
        <div className="hidden leading-tight sm:block">
          <div className="max-w-40 truncate text-sm font-medium" title={admin.email}>
            {admin.name}
          </div>
          <div className="text-[11px] font-medium text-brand-turquoise">{ROLE_LABELS[admin.role]}</div>
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Log out"
            disabled={pending}
            onClick={() => startTransition(() => logoutAction())}
          >
            {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <LogOut />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Log out</TooltipContent>
      </Tooltip>
    </div>
  );
}
