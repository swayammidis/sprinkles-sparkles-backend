/**
 * End-to-end authentication test against a RUNNING server.
 *
 *   TEST_BASE_URL=http://localhost:3001 TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... npm run test:auth
 *
 * Uses MONGODB_URI (from .env.local) to create/remove a temporary inactive admin.
 * Never prints passwords, secrets or the connection string.
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { AdminUser } from "../src/models/AdminUser";
import { AdminSession } from "../src/models/AdminSession";
import { LoginAttempt } from "../src/models/LoginAttempt";
import { hashPassword } from "../src/lib/auth/password";

// Must be set explicitly so these tests never hit a dev server connected to real data by accident.
const BASE = process.env.TEST_BASE_URL ?? "";
if (!BASE) throw new Error("Set TEST_BASE_URL to a test server that uses a throwaway database");
const EMAIL = process.env.TEST_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail !== undefined ? `  → ${JSON.stringify(detail).slice(0, 300)}` : ""}`);
  }
}

/** Minimal cookie jar. */
class Jar {
  private cookies = new Map<string, string>();
  store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      if (!value || /max-age=0|expires=thu, 01 jan 1970/i.test(c)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  has(prefix: string) {
    return [...this.cookies.keys()].some((k) => k.includes(prefix));
  }
  clone() {
    const j = new Jar();
    this.cookies.forEach((v, k) => j.cookies.set(k, v));
    return j;
  }
}

async function get(path: string, jar?: Jar) {
  const res = await fetch(BASE + path, { headers: jar ? { cookie: jar.header() } : {}, redirect: "manual" });
  jar?.store(res);
  return res;
}

/** Sign in through the Auth.js credentials endpoint (same flow the server action uses). */
async function signIn(email: string, password: string) {
  const jar = new Jar();
  const csrfRes = await get("/api/auth/csrf", jar);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header(), origin: BASE },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: `${BASE}/admin` }),
  });
  jar.store(res);
  const location = res.headers.get("location") ?? "";
  const code = new URL(location, BASE).searchParams.get("code");
  return { jar, ok: jar.has("session-token"), location, code };
}

async function signOut(jar: Jar) {
  const { csrfToken } = (await (await get("/api/auth/csrf", jar)).json()) as { csrfToken: string };
  const res = await fetch(`${BASE}/api/auth/signout`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header(), origin: BASE },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${BASE}/login` }),
  });
  jar.store(res);
  return res;
}

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error("Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD");
  await connectDB();
  console.log(`Testing ${BASE}\n`);

  console.log("Protected routes (signed out)");
  const r1 = await get("/admin");
  check("/admin redirects to /login", r1.status === 307 && (r1.headers.get("location") ?? "").includes("/login"), r1.status);
  const r2 = await get("/admin/products");
  check("/admin/* redirects to /login", r2.status === 307 && (r2.headers.get("location") ?? "").includes("/login"), r2.status);
  const r3 = await get("/api/admin/me");
  check("/api/admin/* returns 401", r3.status === 401, r3.status);
  const forged = new Jar();
  forged.store(new Response(null, { headers: { "set-cookie": "authjs.session-token=forged.jwt.value; Path=/" } }));
  const r4 = await get("/api/admin/me", forged);
  check("Forged session cookie rejected", r4.status === 401, r4.status);
  const loginPage = await get("/login");
  check("/login page renders", loginPage.status === 200);

  console.log("\nInvalid credentials");
  const bad = await signIn(EMAIL, "definitely-Wrong-password-1");
  check("Wrong password rejected (no session cookie)", !bad.ok, bad.location);
  check("Error code is invalid_credentials", bad.code === "invalid_credentials", bad.code);
  const unknown = await signIn(`nobody-${Date.now()}@example.com`, "Some-password-123");
  check("Unknown email rejected with the same error", !unknown.ok && unknown.code === "invalid_credentials", unknown.code);
  const malformed = await signIn("not-an-email", "x");
  check("Malformed input rejected server-side", !malformed.ok, malformed.location);
  await LoginAttempt.deleteMany({}); // don't let these failures trip the rate limiter below

  console.log("\nValid login");
  const good = await signIn(EMAIL, PASSWORD);
  check("Valid credentials create a session", good.ok, good.location);
  check("Redirects to /admin", good.location.endsWith("/admin"), good.location);
  const dash = await get("/admin", good.jar);
  const html = await dash.text();
  check("/admin renders for signed-in admin", dash.status === 200 && html.includes("Welcome back"), dash.status);
  check("Admin pages are not cacheable (back button after logout)", (dash.headers.get("cache-control") ?? "").includes("no-store"), dash.headers.get("cache-control"));
  const me = await get("/api/admin/me", good.jar);
  const meText = await me.text();
  check("/api/admin/me returns 200", me.status === 200, me.status);
  check("passwordHash never in API response", !/passwordHash|\$2[aby]\$/.test(meText));
  check("passwordHash never in page HTML", !/passwordHash|\$2[aby]\$/.test(html));
  const sessionJson = await (await get("/api/auth/session", good.jar)).text();
  check("passwordHash never in /api/auth/session", !/passwordHash|\$2[aby]\$/.test(sessionJson));
  const user = await AdminUser.findOne({ email: EMAIL.toLowerCase() }).lean();
  check("lastLoginAt recorded", !!user?.lastLoginAt);
  const stored = await AdminUser.findOne({ email: EMAIL.toLowerCase() }).select("+passwordHash").lean();
  check("Password stored as bcrypt hash (cost 12), not plaintext", !!stored?.passwordHash?.startsWith("$2") && stored.passwordHash.includes("$12$") && stored.passwordHash !== PASSWORD);
  const csrfBlocked = await fetch(`${BASE}/api/admin/me`, { method: "POST", headers: { cookie: good.jar.header(), origin: "https://evil.example" } });
  check("Cross-origin POST to admin API blocked", csrfBlocked.status === 403 || csrfBlocked.status === 405, csrfBlocked.status);

  console.log("\nLogout");
  const stolen = good.jar.clone(); // simulates a copied cookie
  const out = await signOut(good.jar);
  check("Sign-out responds with redirect", out.status === 302 || out.status === 303, out.status);
  check("Session cookie cleared", !good.jar.has("session-token"));
  const after = await get("/admin", good.jar);
  check("/admin redirects to /login after logout", after.status === 307 && (after.headers.get("location") ?? "").includes("/login"), after.status);
  const replay = await get("/api/admin/me", stolen);
  check("Old session cookie is invalid after logout (server-side revocation)", replay.status === 401, replay.status);
  const replayPage = await get("/admin", stolen);
  check("Old cookie on /admin redirects to /login", replayPage.status === 307 && (replayPage.headers.get("location") ?? "").includes("/login"), replayPage.status);

  console.log("\nInactive admin");
  const inactiveEmail = `inactive-${Date.now()}@test.local`;
  const inactivePassword = `Inactive-${Date.now()}-Pw`;
  await AdminUser.create({ name: "Inactive Test", email: inactiveEmail, passwordHash: await hashPassword(inactivePassword), role: "ADMIN", isActive: false });
  const inactive = await signIn(inactiveEmail, inactivePassword);
  check("Inactive admin cannot sign in", !inactive.ok, inactive.location);
  check("Error code is account_inactive", inactive.code === "account_inactive", inactive.code);

  console.log("\nDeactivation takes effect immediately");
  await AdminUser.updateOne({ email: inactiveEmail }, { $set: { isActive: true } });
  const live = await signIn(inactiveEmail, inactivePassword);
  check("Re-activated admin can sign in", live.ok, live.code);
  await AdminUser.updateOne({ email: inactiveEmail }, { $set: { isActive: false } });
  const cut = await get("/api/admin/me", live.jar);
  check("Deactivated admin loses access on next request", cut.status === 401, cut.status);
  await AdminUser.deleteOne({ email: inactiveEmail });
  await AdminSession.deleteMany({});

  console.log("\nBrute-force protection");
  const target = `ratelimit-${Date.now()}@test.local`;
  for (let i = 0; i < 5; i++) await signIn(target, "Wrong-password-123");
  const limited = await signIn(target, "Wrong-password-123");
  check("6th failed attempt is rate-limited", limited.code === "rate_limited", limited.code);
  await LoginAttempt.deleteMany({ key: { $regex: "^(email|ip):" } });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
