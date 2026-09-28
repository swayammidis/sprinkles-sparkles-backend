/**
 * End-to-end test of registration, roles and admin-user management.
 * Needs a RUNNING server connected to an EMPTY throwaway database:
 *
 *   TEST_BASE_URL=http://localhost:3005 MONGODB_URI=... npm run test:registration
 *
 * Never run against production data: it creates and deletes admin accounts.
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { AdminUser } from "../src/models/AdminUser";
import { AdminSession } from "../src/models/AdminSession";

// Must be set explicitly so these tests never hit a dev server connected to real data by accident.
const BASE = process.env.TEST_BASE_URL ?? "";
if (!BASE) throw new Error("Set TEST_BASE_URL to a test server that uses a throwaway database");
const SUPER = { name: "Swayam", email: "admin@example.com", password: "Sw-Admin-Pass-2026" };
const STORE = { name: "Store Admin", email: "store@example.com", password: "Store-Admin-Pass-1" };

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? `  → ${JSON.stringify(detail).slice(0, 300)}` : ""}`);
}

class Jar {
  private c = new Map<string, string>();
  store(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const i = pair.indexOf("=");
      const [k, v] = [pair.slice(0, i), pair.slice(i + 1)];
      if (!v || /max-age=0|expires=thu, 01 jan 1970/i.test(raw)) this.c.delete(k);
      else this.c.set(k, v);
    }
  }
  header() {
    return [...this.c].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  has(s: string) {
    return [...this.c.keys()].some((k) => k.includes(s));
  }
}

async function call(path: string, opts: { method?: string; body?: unknown; jar?: Jar; origin?: string | null } = {}) {
  const headers: Record<string, string> = {};
  if (opts.jar) headers.cookie = opts.jar.header();
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.origin !== null && opts.method && opts.method !== "GET") headers.origin = opts.origin ?? BASE;
  const res = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });
  opts.jar?.store(res);
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, location: res.headers.get("location") ?? "", text, json };
}

async function signIn(email: string, password: string) {
  const jar = new Jar();
  const csrf = await fetch(`${BASE}/api/auth/csrf`);
  jar.store(csrf);
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header(), origin: BASE },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: `${BASE}/admin` }),
  });
  jar.store(res);
  const location = res.headers.get("location") ?? "";
  return { jar, ok: jar.has("session-token"), location, code: new URL(location, BASE).searchParams.get("code") };
}

async function signOut(jar: Jar) {
  const csrf = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: jar.header() } });
  jar.store(csrf);
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const res = await fetch(`${BASE}/api/auth/signout`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header(), origin: BASE },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${BASE}/login` }),
  });
  jar.store(res);
}

const noHash = (s: string) => !/passwordHash|\$2[aby]\$\d\d\$/.test(s);
const redirectsTo = (r: { status: number; location: string }, path: string) => r.status === 307 && r.location.includes(path);

async function main() {
  await connectDB();
  if ((await AdminUser.countDocuments()) > 0) throw new Error("Database must be empty for this test. Refusing to run.");
  console.log(`Testing ${BASE}\n`);

  // ---------------------------------------------------------------- STEP 1
  console.log("STEP 1: first admin registration");
  const regPage = await call("/register");
  check("/register shows the form while no admin exists", regPage.status === 200 && regPage.text.includes("Create Admin Account") && regPage.text.includes("confirmPassword"));
  const loginPage = await call("/login");
  check("/login shows 'Create Admin Account' link during setup", loginPage.text.includes('href="/register"'));
  check("Registration form has no role field", !/name="role"|id="role"/.test(regPage.text));
  check("Registration form has no setup code field", !/setupCode|setup code/i.test(regPage.text));

  const valid = { ...SUPER, confirmPassword: SUPER.password };
  const v1 = await call("/api/auth/register", { method: "POST", body: { ...valid, name: "", email: "bad", password: "short", confirmPassword: "x" } });
  const fe = (v1.json.fieldErrors ?? {}) as Record<string, string>;
  check("Validation: 'Name is required.'", fe.name === "Name is required.", fe);
  check("Validation: 'Please enter a valid email address.'", fe.email === "Please enter a valid email address.", fe);
  check("Validation: 'Password must be at least 8 characters.'", fe.password === "Password must be at least 8 characters.", fe);
  const v2 = await call("/api/auth/register", { method: "POST", body: { ...valid, confirmPassword: "Different-Pass-1" } });
  check("Validation: 'Passwords do not match.'", (v2.json.fieldErrors as Record<string, string>)?.confirmPassword === "Passwords do not match.", v2.json);
  const v3 = await call("/api/auth/register", { method: "POST", body: { ...valid, password: "alllowercase1", confirmPassword: "alllowercase1" } });
  check("Validation: password complexity enforced", v3.status === 422, v3.status);
  const cross = await call("/api/auth/register", { method: "POST", body: valid, origin: "https://evil.example" });
  check("Cross-origin registration blocked", cross.status === 403, cross.status);
  check("Nothing created by failed attempts", (await AdminUser.countDocuments()) === 0);

  // Concurrency: 5 simultaneous valid registrations → exactly one succeeds.
  const race = await Promise.all(
    Array.from({ length: 5 }, () => call("/api/auth/register", { method: "POST", body: { ...valid, email: SUPER.email.toUpperCase(), role: "ADMIN", isActive: false } })),
  );
  const created = race.filter((r) => r.status === 201);
  check("Concurrent registrations: exactly one succeeds", created.length === 1, race.map((r) => r.status));
  check("Response is safe (no hash)", noHash(created[0]?.text ?? ""), created[0]?.text);
  const superDoc = await AdminUser.findOne({ email: SUPER.email }).select("+passwordHash").lean();
  check("Email normalised to lowercase", !!superDoc);
  check("First admin is SUPER_ADMIN (client 'role' ignored)", superDoc?.role === "SUPER_ADMIN", superDoc?.role);
  check("isActive = true (client 'isActive' ignored)", superDoc?.isActive === true);
  check("Password stored as bcrypt hash", !!superDoc?.passwordHash?.startsWith("$2") && superDoc.passwordHash !== SUPER.password);
  check("Only one admin exists", (await AdminUser.countDocuments()) === 1);

  // ---------------------------------------------------------------- STEP 7 (checked early, then again at the end)
  console.log("\nSTEP 7: registration restricted after first admin");
  const again = await call("/api/auth/register", { method: "POST", body: { ...valid, email: "intruder@example.com" } });
  check("POST /api/auth/register → 403 'Admin registration is currently restricted.'", again.status === 403 && again.json.error === "Admin registration is currently restricted.", again.json);
  const regRestricted = await call("/register");
  check("/register shows restricted message", regRestricted.text.includes("Admin registration is currently restricted") && !regRestricted.text.includes('name="confirmPassword"'));
  const loginAfter = await call("/login");
  check("/login no longer shows the registration link", !loginAfter.text.includes('href="/register"'));

  // ---------------------------------------------------------------- STEP 2
  console.log("\nSTEP 2: sign in as SUPER_ADMIN");
  const wrong = await signIn(SUPER.email, "Wrong-Password-9");
  check("Wrong password → invalid_credentials", !wrong.ok && wrong.code === "invalid_credentials", wrong.code);
  const unknown = await signIn("ghost@example.com", "Wrong-Password-9");
  check("Unknown email → same invalid_credentials (no enumeration)", !unknown.ok && unknown.code === "invalid_credentials", unknown.code);
  const sa = await signIn(SUPER.email.toUpperCase(), SUPER.password);
  check("Login succeeds (email case-insensitive) and redirects to /admin", sa.ok && sa.location.endsWith("/admin"), sa.location);
  const dash = await call("/admin", { jar: sa.jar });
  check("/admin renders", dash.status === 200 && dash.text.includes("Welcome back"), dash.status);
  const session = await call("/api/auth/session", { jar: sa.jar });
  check("Session contains no password/hash/secrets", noHash(session.text) && !/password/i.test(session.text), session.text);
  check("Sidebar shows Admin Users + Settings for SUPER_ADMIN", dash.text.includes('href="/admin/users"') && dash.text.includes('href="/admin/settings"'));

  // ---------------------------------------------------------------- STEP 3
  console.log("\nSTEP 3: SUPER_ADMIN opens /admin/users");
  const usersPage = await call("/admin/users", { jar: sa.jar });
  check("/admin/users → 200", usersPage.status === 200 && usersPage.text.includes("Admin Users"), usersPage.status);
  check("Page contains no password hashes", noHash(usersPage.text));
  const list = await call("/api/admin/users", { jar: sa.jar });
  check("GET /api/admin/users → 200 without hashes", list.status === 200 && noHash(list.text), list.status);
  const sec = await call("/admin/settings/security", { jar: sa.jar });
  check("/admin/settings/security → 200 for SUPER_ADMIN", sec.status === 200, sec.status);

  // ---------------------------------------------------------------- STEP 4
  console.log("\nSTEP 4: create Store Admin (ADMIN)");
  const mk = await call("/api/admin/users", { method: "POST", jar: sa.jar, body: { ...STORE, confirmPassword: STORE.password, role: "ADMIN" } });
  check("POST /api/admin/users → 201 ADMIN", mk.status === 201 && (mk.json.user as { role?: string })?.role === "ADMIN", mk.json);
  check("Create response has no hash", noHash(mk.text));
  const storeId = (mk.json.user as { id: string }).id;
  const dup = await call("/api/admin/users", { method: "POST", jar: sa.jar, body: { ...STORE, email: STORE.email.toUpperCase(), confirmPassword: STORE.password, role: "ADMIN" } });
  check("Duplicate email → 409 'An account with this email already exists.'", dup.status === 409 && dup.json.error === "An account with this email already exists.", dup.json);
  const mkBad = await call("/api/admin/users", { method: "POST", jar: sa.jar, body: { ...STORE, email: "x@example.com", confirmPassword: "nope", role: "OWNER" } });
  check("Server-side validation on create (mismatch, bad role) → 422", mkBad.status === 422, mkBad.json);
  const mkSuper = await call("/api/admin/users", { method: "POST", jar: sa.jar, body: { name: "Second Super", email: "super2@example.com", password: "Super-Two-Pass-3", confirmPassword: "Super-Two-Pass-3", role: "SUPER_ADMIN" } });
  check("SUPER_ADMIN can create another SUPER_ADMIN", mkSuper.status === 201, mkSuper.json);
  const super2Id = (mkSuper.json.user as { id: string }).id;

  // ---------------------------------------------------------------- STEP 5
  console.log("\nSTEP 5: sign in as ADMIN");
  await signOut(sa.jar);
  const st = await signIn(STORE.email, STORE.password);
  check("Store Admin signs in", st.ok, st.code);
  for (const p of ["/admin", "/admin/products", "/admin/categories"]) {
    const r = await call(p, { jar: st.jar });
    check(`ADMIN can open ${p}`, r.status === 200, r.status);
  }
  for (const p of ["/admin/users", "/admin/settings", "/admin/settings/security"]) {
    const r = await call(p, { jar: st.jar });
    check(`ADMIN is redirected away from ${p}`, redirectsTo(r, "/admin?forbidden=1"), `${r.status} ${r.location}`);
  }
  const stDash = await call("/admin", { jar: st.jar });
  check("Sidebar hides Admin Users + Settings for ADMIN", !stDash.text.includes('href="/admin/users"') && !stDash.text.includes('href="/admin/settings"'));
  check("ADMIN: GET /api/admin/users → 403", (await call("/api/admin/users", { jar: st.jar })).status === 403);
  check(
    "ADMIN: cannot create admins (POST → 403)",
    (await call("/api/admin/users", { method: "POST", jar: st.jar, body: { name: "Evil", email: "evil@example.com", password: "Evil-Pass-123", confirmPassword: "Evil-Pass-123", role: "SUPER_ADMIN" } })).status === 403,
  );
  check("ADMIN: cannot promote self (PATCH → 403)", (await call(`/api/admin/users/${storeId}`, { method: "PATCH", jar: st.jar, body: { name: STORE.name, email: STORE.email, role: "SUPER_ADMIN" } })).status === 403);
  const superId = String((await AdminUser.findOne({ email: SUPER.email }).lean())!._id);
  check("ADMIN: cannot deactivate a SUPER_ADMIN (→ 403)", (await call(`/api/admin/users/${superId}/status`, { method: "PATCH", jar: st.jar, body: { isActive: false } })).status === 403);
  check("ADMIN: cannot reset passwords (→ 403)", (await call(`/api/admin/users/${superId}/password`, { method: "POST", jar: st.jar, body: { password: "Hijack-Pass-1", confirmPassword: "Hijack-Pass-1" } })).status === 403);
  check("ADMIN: cannot delete admins (→ 403)", (await call(`/api/admin/users/${superId}`, { method: "DELETE", jar: st.jar })).status === 403);

  // ---------------------------------------------------------------- Management actions
  console.log("\nAdmin management (as SUPER_ADMIN)");
  const sa2 = await signIn(SUPER.email, SUPER.password);
  const edit = await call(`/api/admin/users/${storeId}`, { method: "PATCH", jar: sa2.jar, body: { name: "Store Admin Renamed", email: STORE.email, role: "ADMIN" } });
  check("Edit admin → 200", edit.status === 200 && (edit.json.user as { name: string }).name === "Store Admin Renamed", edit.json);
  const editDup = await call(`/api/admin/users/${storeId}`, { method: "PATCH", jar: sa2.jar, body: { name: "X Y", email: SUPER.email, role: "ADMIN" } });
  check("Edit to an existing email → 409", editDup.status === 409, editDup.status);
  check("Cannot change own role → 400", (await call(`/api/admin/users/${superId}`, { method: "PATCH", jar: sa2.jar, body: { name: SUPER.name, email: SUPER.email, role: "ADMIN" } })).status === 400);
  check("Cannot deactivate self → 400", (await call(`/api/admin/users/${superId}/status`, { method: "PATCH", jar: sa2.jar, body: { isActive: false } })).status === 400);
  check("Cannot delete self → 400", (await call(`/api/admin/users/${superId}`, { method: "DELETE", jar: sa2.jar })).status === 400);
  check("Unknown id → 404", (await call(`/api/admin/users/000000000000000000000000/status`, { method: "PATCH", jar: sa2.jar, body: { isActive: false } })).status === 404);

  const deact = await call(`/api/admin/users/${storeId}/status`, { method: "PATCH", jar: sa2.jar, body: { isActive: false } });
  check("Deactivate admin → 200", deact.status === 200, deact.json);
  check("Deactivated admin's live session stops working (→ 401)", (await call("/api/admin/me", { jar: st.jar })).status === 401);
  const inactiveLogin = await signIn(STORE.email, STORE.password);
  check("Inactive admin cannot sign in (account_inactive)", !inactiveLogin.ok && inactiveLogin.code === "account_inactive", inactiveLogin.code);
  await call(`/api/admin/users/${storeId}/status`, { method: "PATCH", jar: sa2.jar, body: { isActive: true } });
  const st2 = await signIn(STORE.email, STORE.password);
  check("Re-activated admin can sign in", st2.ok);

  const reset = await call(`/api/admin/users/${storeId}/password`, { method: "POST", jar: sa2.jar, body: { password: "Brand-New-Pass-7", confirmPassword: "Brand-New-Pass-7" } });
  check("Reset password → 200 without echoing any password", reset.status === 200 && !/Brand-New|passwordHash/.test(reset.text), reset.text);
  check("Reset signs the admin out (→ 401)", (await call("/api/admin/me", { jar: st2.jar })).status === 401);
  check("Old password no longer works", !(await signIn(STORE.email, STORE.password)).ok);
  check("New password works", (await signIn(STORE.email, "Brand-New-Pass-7")).ok);
  const weakReset = await call(`/api/admin/users/${storeId}/password`, { method: "POST", jar: sa2.jar, body: { password: "weak", confirmPassword: "weak" } });
  check("Weak reset password rejected → 422", weakReset.status === 422);

  const demoteOther = await call(`/api/admin/users/${super2Id}`, { method: "PATCH", jar: sa2.jar, body: { name: "Second Super", email: "super2@example.com", role: "ADMIN" } });
  check("Can demote another SUPER_ADMIN while one remains", demoteOther.status === 200, demoteOther.json);
  const del = await call(`/api/admin/users/${super2Id}`, { method: "DELETE", jar: sa2.jar });
  check("Delete admin → 200", del.status === 200 && (await AdminUser.countDocuments({ _id: super2Id })) === 0, del.status);

  // Session expiry: force the session record to expire.
  await AdminSession.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  check("Expired session → 401 on API", (await call("/api/admin/me", { jar: sa2.jar })).status === 401);
  const expiredPage = await call("/admin", { jar: sa2.jar });
  check("Expired session → /login?reason=expired", redirectsTo(expiredPage, "/login?reason=expired"), `${expiredPage.status} ${expiredPage.location}`);

  // ---------------------------------------------------------------- STEP 6
  console.log("\nSTEP 6: signed out");
  const sa3 = await signIn(SUPER.email, SUPER.password);
  await signOut(sa3.jar);
  check("/admin without auth → /login", redirectsTo(await call("/admin"), "/login"));
  check("/admin with logged-out cookie → /login", redirectsTo(await call("/admin", { jar: sa3.jar }), "/login"));
  check("/api/admin/users without auth → 401", (await call("/api/admin/users")).status === 401);

  // ---------------------------------------------------------------- STEP 7 again
  console.log("\nSTEP 7 (again): registration still restricted");
  const later = await call("/api/auth/register", { method: "POST", body: { ...valid, email: "late@example.com" } });
  check("Registration remains restricted", later.status === 403, later.status);
  check("Admin count unchanged by registration attempts", (await AdminUser.countDocuments()) === 2);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
