import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/session";
import { getRegistrationStatus } from "@/lib/auth/setup";
import { SESSION_MAX_AGE } from "@/lib/auth/auth.config";
import { BCRYPT_COST } from "@/lib/auth/password";
import { connectDB } from "@/lib/db";
import { AdminSession } from "@/models/AdminSession";
import { AdminUser } from "@/models/AdminUser";
import { PageHeader } from "@/components/admin/shared/page-header";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Security settings" };

/** SUPER_ADMIN only. Read-only overview of the security configuration. It never displays secret values. */
export default async function SecuritySettingsPage() {
  await requireAdminPage("settings:manage");
  await connectDB();
  const [registration, activeSessions, activeSuperAdmins, inactiveAdmins] = await Promise.all([
    getRegistrationStatus(),
    AdminSession.countDocuments({ expiresAt: { $gt: new Date() } }),
    AdminUser.countDocuments({ role: "SUPER_ADMIN", isActive: true }),
    AdminUser.countDocuments({ isActive: false }),
  ]);

  const rows: [string, React.ReactNode][] = [
    [
      "Public registration (/register)",
      registration === "open" ? (
        <StatusBadge tone="warning">Open: no admin exists yet</StatusBadge>
      ) : (
        <StatusBadge tone="success">Restricted</StatusBadge>
      ),
    ],
    ["Session lifetime", `${SESSION_MAX_AGE / 3600} hours`],
    ["Active sessions", activeSessions],
    ["Active Super Admins", activeSuperAdmins],
    ["Inactive admins", inactiveAdmins],
    ["Password hashing", `bcrypt, cost ${BCRYPT_COST}`],
    ["Sign-in protection", "5 failed attempts per email / 25 per IP per 15 minutes"],
  ];

  return (
    <>
      <PageHeader title="Security" description="Current security configuration. Secret values are never displayed." />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
