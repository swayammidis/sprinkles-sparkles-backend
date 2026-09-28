/**
 * Sprinkle & Sparkle: backend API smoke test.
 *
 * Exercises the REAL HTTP API of a running server. All test data is created and
 * deleted through the API itself (no direct database access). Every record carries
 * a unique run id (API_TEST_<timestamp>), and cleanup only deletes records whose
 * id was captured during this run AND whose name still contains that run id.
 *
 *   npm run test:api
 *
 * Environment (e.g. in .env.local; never NEXT_PUBLIC_):
 *   API_TEST_BASE_URL        e.g. http://localhost:3001
 *   API_TEST_ADMIN_EMAIL     an existing admin (SUPER_ADMIN recommended)
 *   API_TEST_ADMIN_PASSWORD
 *   API_TEST_ALLOW_REMOTE=true   required to target a non-localhost URL
 *
 * Passwords, cookies and secrets are never printed.
 */
import sharp from "sharp";

// ---------------------------------------------------------------------------
// Configuration & safety
// ---------------------------------------------------------------------------

const BASE = (process.env.API_TEST_BASE_URL ?? "").replace(/\/$/, "");
const EMAIL = process.env.API_TEST_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.API_TEST_ADMIN_PASSWORD ?? "";

function fatal(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(2);
}
if (!BASE) fatal("Set API_TEST_BASE_URL (e.g. http://localhost:3001).");
if (!EMAIL || !PASSWORD) fatal("Set API_TEST_ADMIN_EMAIL and API_TEST_ADMIN_PASSWORD (an existing admin account).");
let baseUrl: URL;
try {
  baseUrl = new URL(BASE);
} catch {
  fatal("API_TEST_BASE_URL is not a valid URL.");
}
if (!["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname) && process.env.API_TEST_ALLOW_REMOTE !== "true") {
  fatal(`Refusing to run against ${baseUrl.origin}. Set API_TEST_ALLOW_REMOTE=true to test a non-local server.`);
}

const RUN = `API_TEST_${Date.now()}`;
const run = RUN.toLowerCase().replace(/_/g, "-"); // for slugs/SKUs/emails
const SKU = `API-TEST-SPRINKLES-001-${RUN.slice(9)}`;

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

type Outcome = { name: string; status: "pass" | "fail" | "skip"; evidence?: string; failure?: FailInfo; reason?: string };
type FailInfo = { endpoint?: string; expected?: string; received?: string; error?: string; field?: string };

class StepFailure extends Error {
  constructor(public info: FailInfo) {
    super(info.error ?? "failed");
  }
}

const outcomes: Outcome[] = [];
const endpointResults = new Map<string, "PASS" | "FAIL">();

function markEndpoint(key: string, ok: boolean) {
  if (!ok) endpointResults.set(key, "FAIL");
  else if (!endpointResults.has(key)) endpointResults.set(key, "PASS");
}

async function step(name: string, requires: unknown[], fn: () => Promise<string | void>) {
  if (requires.some((r) => r === undefined || r === null || r === false)) {
    outcomes.push({ name, status: "skip", reason: "prerequisite step failed" });
    console.log(`  – ${name}  (skipped: prerequisite failed)`);
    return;
  }
  try {
    const evidence = (await fn()) ?? undefined;
    outcomes.push({ name, status: "pass", evidence });
    console.log(`  ✓ ${name}${evidence ? `\n      ${evidence}` : ""}`);
  } catch (e) {
    const info: FailInfo = e instanceof StepFailure ? e.info : { error: e instanceof Error ? e.message : String(e) };
    outcomes.push({ name, status: "fail", failure: info });
    console.log(`  ✗ ${name}`);
    if (info.endpoint) console.log(`      Endpoint: ${info.endpoint}`);
    if (info.expected) console.log(`      Expected: ${info.expected}`);
    if (info.received) console.log(`      Received: ${info.received}`);
    if (info.error) console.log(`      Error:    ${info.error}`);
    if (info.field) console.log(`      Field:    ${info.field}`);
  }
}

function assert(condition: unknown, info: FailInfo): asserts condition {
  if (!condition) throw new StepFailure(info);
}

// ---------------------------------------------------------------------------
// HTTP client with a cookie jar (the app uses httpOnly session cookies)
// ---------------------------------------------------------------------------

class Session {
  private cookies = new Map<string, string>();
  store(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (!value || /max-age=0/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  hasSession() {
    return [...this.cookies.keys()].some((k) => k.endsWith("authjs.session-token"));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
type Res = { status: number; json: Json; text: string; endpoint: string; headers: Headers };

async function http(method: string, path: string, opts: { session?: Session | null; body?: unknown; form?: FormData; origin?: string } = {}): Promise<Res> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.session) headers.cookie = opts.session.header();
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  // Browsers send Origin on state-changing requests; the API requires it (CSRF protection).
  if (method !== "GET") headers.origin = opts.origin ?? baseUrl.origin;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    redirect: "manual",
  });
  opts.session?.store(res);
  const text = await res.text();
  let json: Json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const endpoint = `${method} ${path.split("?")[0]}`;
  return { status: res.status, json, text, endpoint, headers: res.headers };
}

/** Error text from the API (already user-safe; the server never returns stack traces or DB errors). */
function apiError(r: Res) {
  const fe = r.json?.fieldErrors ? ` fieldErrors=${JSON.stringify(r.json.fieldErrors)}` : "";
  return `${r.json?.error ?? r.text.slice(0, 120)}${fe}`;
}

function expectStatus(r: Res, expected: number | number[], field?: string, endpointKey?: string) {
  if (r.status === 201 && ![expected].flat().includes(201)) trackUnexpected(r);
  const ok = Array.isArray(expected) ? expected.includes(r.status) : r.status === expected;
  markEndpoint(endpointKey ?? r.endpoint.replace(/\/[a-f0-9]{24}/g, "/[id]").replace(/^(GET \/api\/public\/[a-z]+)\/[^/]+$/, "$1/[slug]"), ok);
  assert(ok, { endpoint: r.endpoint, expected: String(expected), received: String(r.status), error: apiError(r), field });
}

// ---------------------------------------------------------------------------
// Payload builders (shapes taken from src/lib/validations/*.ts)
// ---------------------------------------------------------------------------

const taxonomy = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  slug: "",
  description: "Temporary record created by the backend API smoke test.",
  imageMedia: "",
  sortOrder: 0,
  isActive: true,
  category: "",
  ...extra,
});

type ProductPayload = Record<string, unknown> & { variants: unknown[]; images: unknown[] };
const productPayload = (overrides: Record<string, unknown> = {}): ProductPayload => ({
  status: "draft",
  name: `API Test Rainbow Sprinkles ${RUN}`,
  sku: SKU,
  slug: "",
  shortDescription: "Temporary product created to verify the Sprinkle & Sparkle backend.",
  description: "This is a temporary backend API test product.",
  price: "180",
  salePrice: "150",
  stockQuantity: 25,
  allowBackorder: false,
  category: "",
  subcategory: "",
  brand: "",
  collections: [],
  occasions: [],
  tags: [run],
  images: [],
  hasVariants: false,
  variantType: "Size",
  variants: [],
  shipping: { weight: "", length: "", width: "", height: "" },
  featured: true,
  newArrival: true,
  bestSeller: false,
  seoTitle: "",
  seoDescription: "",
  ...overrides,
});

// ---------------------------------------------------------------------------
// State captured during the run (only these ids may be deleted)
// ---------------------------------------------------------------------------

const created: Record<string, string | undefined> = {};
/** Records created by requests that SHOULD have failed (bugs). Tracked so cleanup still removes them. */
const unexpected: { kind: string; id: string }[] = [];
function trackUnexpected(r: Res) {
  const id = r.json?.id ?? r.json?.item?.id;
  if (!id) return;
  const m = r.endpoint.match(/\/api\/admin\/(products|categories|subcategories|brands|collections|occasions)/);
  if (m) unexpected.push({ kind: m[1], id });
}
let admin: Session | undefined;
let role: string | undefined;
let productSlug: string | undefined;
let productValues: Json;
let publicProductId: string | undefined;
let categorySlug: string | undefined;
let subcategorySlug: string | undefined;
let collectionSlug: string | undefined;
let occasionSlug: string | undefined;
let brandSlug: string | undefined;

async function signIn(email: string, password: string) {
  const s = new Session();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  s.store(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: s.header(), origin: baseUrl.origin },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: `${BASE}/admin` }),
  });
  s.store(res);
  const location = res.headers.get("location") ?? "";
  return { session: s, status: res.status, location, code: new URL(location || "/", BASE).searchParams.get("code") };
}

async function getAdminProduct(id: string) {
  const r = await http("GET", `/api/admin/products/${id}`, { session: admin });
  expectStatus(r, 200);
  return r.json;
}

// ---------------------------------------------------------------------------
// Test plan
// ---------------------------------------------------------------------------

async function main() {
  const line = "=".repeat(48);
  console.log(`${line}\nSPRINKLE & SPARKLE API SMOKE TEST\n${line}`);
  console.log(`Target:  ${baseUrl.origin}`);
  console.log(`Run id:  ${RUN}\n`);

  // ----------------------------------------------------------------- health
  await step("Server reachable (GET /api/public/categories)", [true], async () => {
    const r = await http("GET", "/api/public/categories");
    expectStatus(r, 200);
    return `HTTP ${r.status}; /api/health is NOT IMPLEMENTED in this project, so the public categories endpoint is used as a liveness check`;
  });

  // ----------------------------------------------------------------- auth
  console.log("\nAuthentication");
  await step("Wrong password is rejected (runs first; the next successful login resets the failure counter)", [true], async () => {
    const bad = await signIn(EMAIL, `wrong-${Math.random().toString(36).slice(2)}A1`);
    assert(!bad.session.hasSession() && bad.code === "invalid_credentials", { endpoint: "POST /api/auth/callback/credentials", expected: "no session, code=invalid_credentials", received: `code=${bad.code}` });
    return "no session cookie; error code invalid_credentials";
  });

  await step("Authentication (Auth.js credentials login)", [true], async () => {
    const { session, status, location, code } = await signIn(EMAIL, PASSWORD);
    markEndpoint("POST /api/auth/[...nextauth] (callback/credentials)", session.hasSession());
    assert(session.hasSession(), { endpoint: "POST /api/auth/callback/credentials", expected: "session cookie + redirect to /admin", received: `HTTP ${status}, redirect ${location.replace(BASE, "")}`, error: code ?? "no session cookie" });
    const me = await http("GET", "/api/admin/me", { session });
    expectStatus(me, 200);
    const sess = await http("GET", "/api/auth/session", { session });
    markEndpoint("GET /api/auth/[...nextauth] (session)", sess.status === 200);
    assert(sess.json?.user?.email?.toLowerCase() === EMAIL.toLowerCase(), { endpoint: "GET /api/auth/session", error: "session does not contain the signed-in admin" });
    assert(!/passwordHash|\$2[aby]\$/.test(me.text + sess.text), { endpoint: "GET /api/admin/me", error: "password hash leaked in response" });
    admin = session;
    role = me.json.admin.role;
    return `HTTP ${status} → ${location.replace(BASE, "")}; httpOnly session cookie received; /api/admin/me → 200 role=${role}; no password hash in responses`;
  });

  await step("Public registration is closed (POST /api/auth/register)", [true], async () => {
    const r = await http("POST", "/api/auth/register", { body: { name: "Intruder", email: `${run}@example.test`, password: "Intruder-Pass-1", confirmPassword: "Intruder-Pass-1" } });
    expectStatus(r, 403);
    return `HTTP 403 "${r.json?.error}" (an admin already exists)`;
  });

  // ----------------------------------------------------------------- unauthorized
  console.log("\nUnauthorized access (no session)");
  await step("Unauthorized requests are rejected", [true], async () => {
    const checks: [string, string, unknown?][] = [
      ["GET", "/api/admin/products"],
      ["POST", "/api/admin/products", productPayload({ name: `UNAUTH ${RUN}` })],
      ["POST", "/api/admin/categories", taxonomy(`UNAUTH ${RUN}`)],
      ["PUT", "/api/admin/products/000000000000000000000000", productPayload()],
      ["DELETE", "/api/admin/products/000000000000000000000000"],
      ["GET", "/api/admin/users"],
      ["POST", "/api/admin/media"],
      ["PUT", "/api/admin/settings", {}],
    ];
    const got: string[] = [];
    for (const [m, p, body] of checks) {
      const r = await http(m, p, { session: null, body });
      got.push(`${m} ${p.replace("000000000000000000000000", "[id]")} → ${r.status}`);
      assert(r.status === 401, { endpoint: `${m} ${p}`, expected: "401", received: String(r.status), error: apiError(r) });
    }
    return got.join("; ");
  });

  // ----------------------------------------------------------------- taxonomy
  console.log("\nCatalog organisation");
  await step("Create Category", [admin], async () => {
    const r = await http("POST", "/api/admin/categories", { session: admin, body: taxonomy(`API Test Category ${RUN}`) });
    expectStatus(r, 201, "name/description/isActive");
    const item = r.json.item;
    assert(item?.id && item.name === `API Test Category ${RUN}` && item.slug && item.isActive === true, { endpoint: r.endpoint, error: "response missing id/name/slug/isActive", received: JSON.stringify(item) });
    created.category = item.id;
    categorySlug = item.slug;
    return `HTTP 201 id=${item.id} slug=${item.slug} isActive=${item.isActive}`;
  });
  await step("Get Category", [created.category], async () => {
    const r = await http("GET", `/api/admin/categories/${created.category}`, { session: admin });
    expectStatus(r, 200);
    assert(r.json.item.name === `API Test Category ${RUN}`, { endpoint: r.endpoint, error: "name mismatch" });
    const list = await http("GET", `/api/admin/categories?q=${encodeURIComponent(RUN)}`, { session: admin });
    expectStatus(list, 200);
    assert(list.json.items.length === 1 && list.json.items[0].id === created.category, { endpoint: list.endpoint, error: "search did not return exactly the test category" });
    return `GET by id → 200 "${r.json.item.name}"; GET list ?q=run id → exactly 1 match (record persisted)`;
  });
  await step("Create Subcategory", [created.category], async () => {
    const r = await http("POST", "/api/admin/subcategories", { session: admin, body: taxonomy(`API Test Subcategory ${RUN}`, { category: created.category }) });
    expectStatus(r, 201, "category");
    created.subcategory = r.json.item.id;
    subcategorySlug = r.json.item.slug;
    const g = await http("GET", `/api/admin/subcategories/${created.subcategory}`, { session: admin });
    expectStatus(g, 200);
    assert(g.json.item.categoryId === created.category && g.json.item.categoryName === `API Test Category ${RUN}`, { endpoint: g.endpoint, error: "parent category not returned", received: JSON.stringify({ categoryId: g.json.item.categoryId }) });
    const byParent = await http("GET", `/api/admin/subcategories?category=${created.category}`, { session: admin });
    expectStatus(byParent, 200);
    assert(byParent.json.items.length === 1, { endpoint: byParent.endpoint, error: "filter by parent category failed" });
    return `HTTP 201 id=${created.subcategory}; GET → parent categoryId=${g.json.item.categoryId} ("${g.json.item.categoryName}"); list ?category= → 1`;
  });
  for (const [kind, label] of [
    ["brands", "Brand"],
    ["collections", "Collection"],
    ["occasions", "Occasion"],
  ] as const) {
    await step(`Create ${label}`, [admin], async () => {
      const name = label === "Occasion" ? `API Test Birthday ${RUN}` : `API Test ${label} ${RUN}`;
      const r = await http("POST", `/api/admin/${kind}`, { session: admin, body: taxonomy(name) });
      expectStatus(r, 201);
      const id = r.json.item.id;
      created[label.toLowerCase()] = id;
      const g = await http("GET", `/api/admin/${kind}/${id}`, { session: admin });
      expectStatus(g, 200);
      assert(g.json.item.name === name && g.json.item.slug && g.json.item.isActive === true, { endpoint: g.endpoint, error: "retrieved record differs" });
      if (label === "Brand") brandSlug = g.json.item.slug;
      if (label === "Collection") collectionSlug = g.json.item.slug;
      if (label === "Occasion") occasionSlug = g.json.item.slug;
      return `HTTP 201 id=${id}; GET → 200 slug=${g.json.item.slug} isActive=${g.json.item.isActive}`;
    });
  }
  await step("Update, deactivate/activate and reorder a category", [created.category], async () => {
    const put = await http("PUT", `/api/admin/categories/${created.category}`, { session: admin, body: taxonomy(`API Test Category ${RUN}`, { slug: categorySlug, description: "Updated by API smoke test." }) });
    expectStatus(put, 200);
    assert(put.json.item.description === "Updated by API smoke test.", { endpoint: put.endpoint, error: "description not updated" });
    const off = await http("PATCH", `/api/admin/categories/${created.category}`, { session: admin, body: { isActive: false } });
    expectStatus(off, 200);
    assert(off.json.item.isActive === false, { endpoint: off.endpoint, error: "not deactivated" });
    const on = await http("PATCH", `/api/admin/categories/${created.category}`, { session: admin, body: { isActive: true } });
    expectStatus(on, 200);
    const reorder = await http("POST", "/api/admin/subcategories/reorder", { session: admin, body: { ids: [created.subcategory] } });
    expectStatus(reorder, 200);
    return "PUT → 200 (description persisted); PATCH isActive=false → 200; PATCH isActive=true → 200; POST /subcategories/reorder (test record only) → 200";
  });

  await step("List / update / activate / reorder for every catalog group", [created.category, created.subcategory, created.brand, created.collection, created.occasion], async () => {
    const out: string[] = [];
    for (const [kind, key] of [
      ["categories", "category"],
      ["subcategories", "subcategory"],
      ["brands", "brand"],
      ["collections", "collection"],
      ["occasions", "occasion"],
    ] as const) {
      const id = created[key]!;
      const list = await http("GET", `/api/admin/${kind}?q=${encodeURIComponent(RUN)}`, { session: admin });
      expectStatus(list, 200);
      assert(list.json.items.some((i: Json) => i.id === id), { endpoint: list.endpoint, error: "created record not listed" });
      const current = (await http("GET", `/api/admin/${kind}/${id}`, { session: admin })).json.item;
      const put = await http("PUT", `/api/admin/${kind}/${id}`, {
        session: admin,
        body: taxonomy(current.name, { slug: current.slug, description: `Updated ${kind} by API smoke test.`, category: current.categoryId }),
      });
      expectStatus(put, 200);
      assert(put.json.item.description === `Updated ${kind} by API smoke test.` && put.json.item.slug === current.slug, { endpoint: put.endpoint, error: "update not persisted" });
      const off = await http("PATCH", `/api/admin/${kind}/${id}`, { session: admin, body: { isActive: false } });
      expectStatus(off, 200);
      const on = await http("PATCH", `/api/admin/${kind}/${id}`, { session: admin, body: { isActive: true } });
      expectStatus(on, 200);
      assert(off.json.item.isActive === false && on.json.item.isActive === true, { endpoint: on.endpoint, error: "active toggle not persisted" });
      const reorder = await http("POST", `/api/admin/${kind}/reorder`, { session: admin, body: { ids: [id] } });
      expectStatus(reorder, 200);
      out.push(`${kind}: list ✓ PUT ✓ PATCH off/on ✓ reorder ✓`);
    }
    return out.join("; ");
  });

  // ----------------------------------------------------------------- media
  console.log("\nMedia");
  await step("Upload product image (POST /api/admin/media)", [admin], async () => {
    const png = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#f06a9f" } }).png().toBuffer();
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), `${RUN}.png`);
    fd.append("folder", "products");
    const r = await http("POST", "/api/admin/media", { session: admin, form: fd });
    expectStatus(r, 201, "file");
    created.media = r.json.asset.id;
    const served = await fetch(new URL(r.json.asset.url, BASE));
    markEndpoint("GET /media/[...key]", served.ok);
    assert(served.ok, { endpoint: `GET ${r.json.asset.url}`, expected: "200", received: String(served.status) });
    const list = await http("GET", `/api/admin/media?q=${encodeURIComponent(RUN)}`, { session: admin });
    expectStatus(list, 200);
    assert(list.json.items.some((m: Json) => m.id === created.media), { endpoint: list.endpoint, error: "uploaded image not listed" });
    return `HTTP 201 id=${created.media} ${r.json.asset.mimeType} ${r.json.asset.width}×${r.json.asset.height}; file served → ${served.status}; GET /api/admin/media?q= lists it`;
  });
  await step("Non-image upload is rejected", [admin], async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new TextEncoder().encode("<script>alert(1)</script>".padEnd(64))], { type: "image/png" }), `${RUN}-fake.png`);
    const r = await http("POST", "/api/admin/media", { session: admin, form: fd });
    expectStatus(r, 415, "file");
    return `HTTP 415 "${r.json.error}"`;
  });

  // ----------------------------------------------------------------- product
  console.log("\nProducts");
  const deps = () => [created.category, created.subcategory, created.brand, created.collection, created.occasion];
  await step("Create Product (as draft)", [...deps()], async () => {
    const r = await http("POST", "/api/admin/products", {
      session: admin,
      body: productPayload({
        category: created.category,
        subcategory: created.subcategory,
        brand: created.brand,
        collections: [created.collection],
        occasions: [created.occasion],
        images: created.media ? [{ media: created.media, alt: "Test image", isPrimary: true }] : [],
      }),
    });
    expectStatus(r, 201, "product payload");
    created.product = r.json.id;
    assert(r.json.status === "draft", { endpoint: r.endpoint, error: `status=${r.json.status}` });
    const p = await getAdminProduct(created.product!);
    productValues = p.values;
    productSlug = p.values.slug;
    assert(p.values.price === "180" && p.values.salePrice === "150" && p.stockQuantity === 25 && p.stockStatus === "in_stock", { endpoint: `GET /api/admin/products/${created.product}`, error: "saved values differ", received: JSON.stringify({ price: p.values.price, sale: p.values.salePrice, stock: p.stockQuantity, stockStatus: p.stockStatus }) });
    assert(p.values.featured && p.values.newArrival, { endpoint: r.endpoint, error: "featured/newArrival not saved" });
    return `HTTP 201 id=${created.product}; GET → price ₹180, sale ₹150, stock 25, stockStatus=in_stock (server-derived), featured=true, newArrival=true, slug=${productSlug}`;
  });

  await step("Product Relationships", [created.product], async () => {
    const v = productValues;
    const checks = [
      ["category", v.category === created.category],
      ["subcategory", v.subcategory === created.subcategory],
      ["brand", v.brand === created.brand],
      ["collection", v.collections.length === 1 && v.collections[0] === created.collection],
      ["occasion", v.occasions.length === 1 && v.occasions[0] === created.occasion],
      ["image", v.images.length === 1 && v.images[0].media === created.media],
    ] as const;
    for (const [field, ok] of checks) assert(ok, { endpoint: `GET /api/admin/products/${created.product}`, error: `${field} id does not match`, field });
    // Resolve each id through its own endpoint.
    for (const [kind, id, expect] of [
      ["categories", v.category, `API Test Category ${RUN}`],
      ["subcategories", v.subcategory, `API Test Subcategory ${RUN}`],
      ["brands", v.brand, `API Test Brand ${RUN}`],
      ["collections", v.collections[0], `API Test Collection ${RUN}`],
      ["occasions", v.occasions[0], `API Test Birthday ${RUN}`],
    ]) {
      const r = await http("GET", `/api/admin/${kind}/${id}`, { session: admin });
      expectStatus(r, 200, kind);
      assert(r.json.item.name === expect, { endpoint: r.endpoint, error: `${kind} resolved to "${r.json.item.name}"`, field: kind });
    }
    const inCollection = await http("GET", `/api/admin/collections/${created.collection}/products`, { session: admin });
    expectStatus(inCollection, 200);
    assert(inCollection.json.products.some((p: Json) => p.id === created.product), { endpoint: inCollection.endpoint, error: "product not listed in collection" });
    return "category, subcategory, brand, collection, occasion and image ids all match; each id resolves via its GET endpoint; collection → products lists it";
  });

  await step("Draft is hidden from the public API", [created.product], async () => {
    const r = await http("GET", `/api/public/products/${productSlug}`);
    expectStatus(r, 404);
    const search = await http("GET", `/api/public/products?search=${encodeURIComponent(RUN)}`);
    expectStatus(search, 200);
    assert(search.json.data.items.length === 0, { endpoint: search.endpoint, error: "draft appeared in public search" });
    return `GET /api/public/products/${productSlug} → 404; public search → 0 results`;
  });

  await step("Publish Product", [created.product], async () => {
    const r = await http("PATCH", `/api/admin/products/${created.product}`, { session: admin, body: { status: "published" } });
    expectStatus(r, 200, "status");
    assert(r.json.status === "published", { endpoint: r.endpoint, error: `status=${r.json.status}` });
    const pub = await http("GET", `/api/public/products/${productSlug}`);
    expectStatus(pub, 200);
    publicProductId = pub.json.data.id;
    assert(publicProductId === created.product, { endpoint: pub.endpoint, error: "public id differs from created id" });
    return `PATCH status=published → 200; GET /api/public/products/${productSlug} → 200`;
  });

  await step("Public product detail is clean and correct", [publicProductId], async () => {
    const r = await http("GET", `/api/public/products/${productSlug}`);
    const d = r.json.data;
    assert(d.price.amount === "180.00" && d.salePrice.amount === "150.00" && d.fromPrice.paise === 15000, { endpoint: r.endpoint, error: "prices wrong", received: JSON.stringify({ price: d.price, sale: d.salePrice }) });
    assert(d.category?.slug === categorySlug && d.subcategory?.slug === subcategorySlug && d.brand?.slug === brandSlug, { endpoint: r.endpoint, error: "taxonomy refs wrong" });
    assert(d.collections[0]?.slug === collectionSlug && d.occasions[0]?.slug === occasionSlug, { endpoint: r.endpoint, error: "collection/occasion refs wrong" });
    const leaked = ["stockQuantity", "status", "_id", "__v", "effectivePrice", "allowBackorder", "createdAt"].filter((k) => k in d);
    assert(leaked.length === 0 && !r.text.includes('"media"'), { endpoint: r.endpoint, error: `internal fields exposed: ${leaked.join(",")}` });
    return `price 180.00 / sale 150.00 / fromPrice 15000 paise; category=${d.category.slug}, subcategory=${d.subcategory.slug}, brand=${d.brand.slug}; no internal fields`;
  });

  await step("Update Product (price 180→200, stock 25→20, description)", [created.product], async () => {
    const current = await getAdminProduct(created.product!);
    const r = await http("PUT", `/api/admin/products/${created.product}`, {
      session: admin,
      body: { ...current.values, price: "200", stockQuantity: 20, description: "Updated by API smoke test." },
    });
    expectStatus(r, 200, "price/stockQuantity/description");
    const after = await getAdminProduct(created.product!);
    assert(after.values.price === "200" && after.stockQuantity === 20 && after.values.description === "Updated by API smoke test.", { endpoint: `GET /api/admin/products/${created.product}`, error: "update not persisted", received: JSON.stringify({ price: after.values.price, stock: after.stockQuantity }) });
    const pub = (await http("GET", `/api/public/products/${productSlug}`)).json.data;
    assert(pub.price.amount === "200.00" && pub.description === "Updated by API smoke test.", { endpoint: "GET /api/public/products/[slug]", error: "public API not updated" });
    productValues = after.values;
    return "PUT → 200; admin GET shows price 200, stock 20, new description; public API shows ₹200.00";
  });

  await step("Create Variants (100g, 250g; embedded in the product)", [created.product], async () => {
    const current = await getAdminProduct(created.product!);
    const body = {
      ...current.values,
      hasVariants: true,
      variantType: "Weight",
      variants: [
        { label: "100g", sku: `API-TEST-SPRINKLES-100G-${RUN.slice(9)}`, price: "180", salePrice: "", stockQuantity: 10, weight: "100", isActive: true, image: "" },
        { label: "250g", sku: `API-TEST-SPRINKLES-250G-${RUN.slice(9)}`, price: "320", salePrice: "", stockQuantity: 15, weight: "250", isActive: true, image: "" },
      ],
    };
    const r = await http("PUT", `/api/admin/products/${created.product}`, { session: admin, body });
    expectStatus(r, 200, "variants");
    const after = await getAdminProduct(created.product!);
    const vs = after.values.variants;
    assert(vs.length === 2 && vs[0].label === "100g" && vs[0].price === "180" && vs[0].stockQuantity === 10 && vs[1].label === "250g" && vs[1].price === "320" && vs[1].stockQuantity === 15, { endpoint: `GET /api/admin/products/${created.product}`, error: "variants not saved as sent", received: JSON.stringify(vs) });
    assert(vs.every((v: Json) => v.id) && vs[0].sku.startsWith("API-TEST-SPRINKLES-100G"), { endpoint: r.endpoint, error: "variant ids/SKUs missing" });
    assert(after.stockQuantity === 25, { endpoint: r.endpoint, error: `product stock should be 10+15=25, got ${after.stockQuantity}` });
    const pub = (await http("GET", `/api/public/products/${productSlug}`)).json.data;
    assert(pub.variants.length === 2 && pub.variantType === "Weight" && pub.fromPrice.amount === "180.00", { endpoint: "GET /api/public/products/[slug]", error: "public variants wrong", received: JSON.stringify(pub.variants?.map((v: Json) => [v.label, v.price.amount])) });
    return `PUT → 200; variant ids ${vs.map((v: Json) => v.id).join(", ")}; 100g ₹180×10, 250g ₹320×15; product stock derived = 25; public API shows 2 options, from ₹180.00`;
  });

  await step("Create second product for sorting/pagination (published)", [created.category], async () => {
    const r = await http("POST", "/api/admin/products", {
      session: admin,
      body: productPayload({ status: "published", name: `API Test Cake Box ${RUN}`, sku: `API-TEST-BOX-${RUN.slice(9)}`, price: "50", salePrice: "", stockQuantity: 5, featured: false, newArrival: false, category: created.category }),
    });
    expectStatus(r, 201);
    created.product2 = r.json.id;
    return `HTTP 201 id=${created.product2} price ₹50`;
  });

  // ----------------------------------------------------------------- public queries
  console.log("\nSearch, filters, pagination, sorting (public API)");
  const pubList = async (query: string) => {
    const r = await http("GET", `/api/public/products?${query}`);
    expectStatus(r, 200, query, "GET /api/public/products");
    return r;
  };
  await step("Product Search", [publicProductId], async () => {
    const r = await pubList(`search=${encodeURIComponent(`API Test Rainbow Sprinkles ${RUN}`)}`);
    const items = r.json.data.items;
    assert(items.length === 1 && items[0].id === created.product, { endpoint: r.endpoint, error: "search did not return exactly the test product", received: items.map((i: Json) => i.name).join(" | ") });
    const r2 = await pubList(`search=${encodeURIComponent(RUN)}`);
    assert(r2.json.data.items.every((i: Json) => i.name.includes(RUN)), { endpoint: r2.endpoint, error: "unrelated products returned" });
    return `search "API Test Rainbow Sprinkles ${RUN}" → 1 result (${items[0].id}); search by run id → ${r2.json.data.items.length} results, all test products`;
  });
  for (const [label, param, value] of [
    ["Category Filter", "category", () => categorySlug],
    ["Subcategory Filter", "subcategory", () => subcategorySlug],
    ["Collection Filter", "collection", () => collectionSlug],
    ["Occasion Filter", "occasion", () => occasionSlug],
  ] as const) {
    await step(label, [publicProductId, value()], async () => {
      const r = await pubList(`${param}=${value()}&pageSize=48`);
      const items = r.json.data.items;
      assert(items.some((i: Json) => i.id === created.product), { endpoint: r.endpoint, error: "test product not returned", field: param });
      if (param === "category" || param === "subcategory") {
        assert(items.every((i: Json) => i[param]?.slug === value()), { endpoint: r.endpoint, error: `returned products from another ${param}`, field: param });
      } else {
        assert(items.every((i: Json) => i.name.includes(RUN)), { endpoint: r.endpoint, error: `unrelated products returned for ${param}`, field: param });
      }
      return `?${param}=${value()} → ${items.length} product(s); test product included; all results belong to the filter`;
    });
  }
  await step("Featured Products", [publicProductId], async () => {
    const r = await pubList(`featured=true&search=${encodeURIComponent(RUN)}`);
    const items = r.json.data.items;
    assert(items.length === 1 && items[0].id === created.product && items[0].badges.featured, { endpoint: r.endpoint, error: "featured filter wrong", received: items.map((i: Json) => i.name).join(" | ") });
    const all = await pubList("featured=true&pageSize=48");
    assert(all.json.data.items.every((i: Json) => i.badges.featured), { endpoint: all.endpoint, error: "non-featured product returned" });
    return `?featured=true (scoped to run) → only the featured test product; global featured list → all have badges.featured=true`;
  });
  await step("New Arrivals", [publicProductId], async () => {
    const r = await pubList(`newArrival=true&search=${encodeURIComponent(RUN)}`);
    const items = r.json.data.items;
    assert(items.length === 1 && items[0].id === created.product && items[0].badges.newArrival, { endpoint: r.endpoint, error: "newArrival filter wrong" });
    return "?newArrival=true → the test product (the non-new Cake Box is excluded)";
  });
  await step("Product Slug", [publicProductId], async () => {
    const r = await http("GET", `/api/public/products/${productSlug}`);
    expectStatus(r, 200);
    assert(r.json.data.slug === productSlug && r.json.data.id === created.product, { endpoint: r.endpoint, error: "slug/id mismatch" });
    const missing = await http("GET", `/api/public/products/${run}-does-not-exist`);
    expectStatus(missing, 404, undefined, "GET /api/public/products/[slug]");
    return `slug ${productSlug} → id ${r.json.data.id} (matches created id); unknown slug → 404`;
  });
  await step("Pagination", [publicProductId, created.product2], async () => {
    const r = await pubList("page=1&pageSize=10");
    const p = r.json.data.pagination;
    assert(Array.isArray(r.json.data.items) && r.json.data.items.length <= 10 && p.page === 1 && p.pageSize === 10 && typeof p.total === "number" && typeof p.totalPages === "number", { endpoint: r.endpoint, error: "pagination shape wrong", received: JSON.stringify(p) });
    const a = await pubList(`search=${encodeURIComponent(RUN)}&pageSize=1&page=1&sort=name_asc`);
    const b = await pubList(`search=${encodeURIComponent(RUN)}&pageSize=1&page=2&sort=name_asc`);
    assert(a.json.data.pagination.total === 2 && a.json.data.pagination.totalPages === 2 && a.json.data.items[0].id !== b.json.data.items[0]?.id, { endpoint: a.endpoint, error: "pages overlap or wrong totals", received: JSON.stringify(a.json.data.pagination) });
    const admin1 = await http("GET", `/api/admin/products?q=${encodeURIComponent(RUN)}&pageSize=5&page=1`, { session: admin });
    expectStatus(admin1, 200);
    assert(admin1.json.total === 2 && admin1.json.page === 1 && admin1.json.pageSize === 5, { endpoint: admin1.endpoint, error: "admin pagination wrong" });
    return `page=1&pageSize=10 → ${r.json.data.items.length} items, meta {page:1,pageSize:10,total:${p.total},totalPages:${p.totalPages}}; test products paged 1/2 and 2/2 with no overlap; admin list total=2`;
  });
  await step("Sorting", [publicProductId, created.product2], async () => {
    const asc = (await pubList(`search=${encodeURIComponent(RUN)}&sort=price_asc`)).json.data.items;
    const desc = (await pubList(`search=${encodeURIComponent(RUN)}&sort=price_desc`)).json.data.items;
    assert(asc[0].id === created.product2 && asc[1].id === created.product && desc[0].id === created.product, { endpoint: "GET /api/public/products?sort=", error: "order wrong", received: asc.map((i: Json) => i.fromPrice.amount).join(" < ") });
    const adminSort = await http("GET", `/api/admin/products?q=${encodeURIComponent(RUN)}&sort=price_asc`, { session: admin });
    expectStatus(adminSort, 200);
    assert(adminSort.json.items[0].id === created.product2, { endpoint: adminSort.endpoint, error: "admin price sort wrong" });
    return `public price_asc: ₹${asc.map((i: Json) => i.fromPrice.amount).join(" < ₹")}; price_desc reversed; admin sort=price_asc agrees`;
  });
  await step("Public taxonomy endpoints", [categorySlug, subcategorySlug, collectionSlug, occasionSlug, brandSlug], async () => {
    const results: string[] = [];
    const cats = await http("GET", "/api/public/categories");
    expectStatus(cats, 200);
    const cat = cats.json.data.find((c: Json) => c.slug === categorySlug);
    assert(cat?.subcategories.some((s: Json) => s.slug === subcategorySlug), { endpoint: cats.endpoint, error: "category/subcategory missing" });
    results.push("categories ✓");
    for (const [path, key] of [
      [`/api/public/categories/${categorySlug}`, "GET /api/public/categories/[slug]"],
      [`/api/public/subcategories/${subcategorySlug}`, "GET /api/public/subcategories/[slug]"],
      [`/api/public/subcategories?category=${categorySlug}`, "GET /api/public/subcategories"],
      [`/api/public/collections/${collectionSlug}`, "GET /api/public/collections/[slug]"],
      ["/api/public/collections", "GET /api/public/collections"],
      [`/api/public/occasions/${occasionSlug}`, "GET /api/public/occasions/[slug]"],
      ["/api/public/occasions", "GET /api/public/occasions"],
      [`/api/public/brands/${brandSlug}`, "GET /api/public/brands/[slug]"],
      ["/api/public/brands", "GET /api/public/brands"],
      ["/api/public/store", "GET /api/public/store"],
    ] as const) {
      const r = await http("GET", path);
      expectStatus(r, 200, undefined, key);
      results.push(`${path.split("?")[0].replace("/api/public/", "")} ✓`);
    }
    const sub = (await http("GET", `/api/public/subcategories/${subcategorySlug}`)).json.data;
    assert(sub.category.slug === categorySlug, { endpoint: "GET /api/public/subcategories/[slug]", error: "parent category wrong" });
    const cors = await fetch(`${BASE}/api/public/products`, { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "GET" } });
    assert(!cors.headers.get("access-control-allow-origin"), { endpoint: "OPTIONS /api/public/products", error: "CORS granted to an unknown origin" });
    markEndpoint("OPTIONS /api/public/*", true);
    return `${results.length} endpoints → 200; unknown-origin CORS not granted`;
  });

  // ----------------------------------------------------------------- validation
  console.log("\nValidation");
  const countBySku = async (sku: string) => {
    const r = await http("GET", `/api/admin/products?q=${encodeURIComponent(sku)}`, { session: admin });
    return r.json.items.filter((p: Json) => p.sku === sku).length;
  };
  await step("Validation (invalid input is rejected and not saved)", [created.category], async () => {
    const cases: [string, string, unknown, number | number[], string][] = [
      ["product without name", "/api/admin/products", productPayload({ name: "", sku: `${SKU}-X1` }), 422, "name"],
      ["product with invalid price", "/api/admin/products", productPayload({ price: "abc", sku: `${SKU}-X2` }), 422, "price"],
      ["product with sale ≥ price", "/api/admin/products", productPayload({ salePrice: "999", sku: `${SKU}-X3` }), 422, "salePrice"],
      ["product with malformed category id", "/api/admin/products", productPayload({ category: "not-an-id", sku: `${SKU}-X4` }), 422, "category"],
      ["product with non-existent category id", "/api/admin/products", productPayload({ category: "000000000000000000000000", sku: `${SKU}-X5` }), 422, "category"],
      ["publish without SKU", "/api/admin/products", productPayload({ status: "published", sku: "", category: created.category }), 422, "sku"],
      ["category without name", "/api/admin/categories", taxonomy(""), 422, "name"],
      ["subcategory without parent", "/api/admin/subcategories", taxonomy(`API Test Orphan ${RUN}`), 422, "category"],
    ];
    const out: string[] = [];
    for (const [label, path, body, expected, field] of cases) {
      const r = await http("POST", path, { session: admin, body });
      expectStatus(r, expected, field, `POST ${path}`);
      assert(r.json?.fieldErrors?.[field] || r.json?.error, { endpoint: `POST ${path}`, error: "no validation message", field });
      out.push(`${label} → ${r.status} "${r.json.fieldErrors?.[field] ?? r.json.error}"`);
    }
    for (const n of [1, 2, 3, 4, 5]) assert((await countBySku(`${SKU}-X${n}`)) === 0, { endpoint: "GET /api/admin/products", error: `invalid product ${SKU}-X${n} was saved` });
    const orphan = await http("GET", `/api/admin/subcategories?q=${encodeURIComponent(`API Test Orphan ${RUN}`)}`, { session: admin });
    assert(orphan.json.items.length === 0, { endpoint: orphan.endpoint, error: "invalid subcategory was saved" });
    return out.join("\n      ") + "\n      none of the invalid records exist afterwards";
  });
  await step("Duplicate SKU", [created.product], async () => {
    const r = await http("POST", "/api/admin/products", { session: admin, body: productPayload({ name: `API Test Duplicate ${RUN}`, category: created.category }) });
    expectStatus(r, 409, "sku");
    const count = await countBySku(SKU);
    assert(count === 1, { endpoint: "GET /api/admin/products", error: `expected exactly 1 product with SKU, found ${count}` });
    const dupVariant = await http("POST", "/api/admin/products", {
      session: admin,
      body: productPayload({ name: `API Test Duplicate V ${RUN}`, sku: `${SKU}-V`, hasVariants: true, variants: [{ label: "x", sku: `API-TEST-SPRINKLES-100G-${RUN.slice(9)}`, price: "10", salePrice: "", stockQuantity: 1, weight: "", isActive: true, image: "" }] }),
    });
    expectStatus(dupVariant, 409, "variants.sku", "POST /api/admin/products");
    return `HTTP 409 "${r.json.error}"; exactly 1 product with this SKU; duplicate variant SKU → 409`;
  });

  // ----------------------------------------------------------------- admin extras
  console.log("\nOther admin endpoints");
  await step("Product quick actions, lookup and duplicate", [created.product], async () => {
    const unfeature = await http("PATCH", `/api/admin/products/${created.product}`, { session: admin, body: { featured: false } });
    expectStatus(unfeature, 200);
    const refeature = await http("PATCH", `/api/admin/products/${created.product}`, { session: admin, body: { featured: true } });
    expectStatus(refeature, 200);
    const lookup = await http("GET", `/api/admin/products/lookup?q=${encodeURIComponent(RUN)}`, { session: admin });
    expectStatus(lookup, 200);
    assert(lookup.json.products.length === 2, { endpoint: lookup.endpoint, error: `expected 2 test products, got ${lookup.json.products.length}` });
    const dup = await http("POST", `/api/admin/products/${created.product}/duplicate`, { session: admin });
    expectStatus(dup, 201);
    created.product3 = dup.json.id;
    const copy = await getAdminProduct(created.product3!);
    assert(copy.values.status === "draft" && copy.values.sku === "" && copy.values.name.includes(RUN), { endpoint: dup.endpoint, error: "duplicate should be a draft without SKU" });
    return `PATCH featured → 200 ×2; lookup → 2; duplicate → 201 id=${created.product3} (draft, no SKU)`;
  });
  await step("Collection product assignment", [created.collection, created.product2], async () => {
    // Measure the starting state: the duplicated product (previous step) intentionally keeps the collection.
    const before = await http("GET", `/api/admin/collections/${created.collection}/products`, { session: admin });
    expectStatus(before, 200);
    const ids = (r: Res) => r.json.products.map((p: Json) => p.id) as string[];
    assert(!ids(before).includes(created.product2!), { endpoint: before.endpoint, error: "Cake Box unexpectedly already in collection" });
    const add = await http("POST", `/api/admin/collections/${created.collection}/products`, { session: admin, body: { productIds: [created.product2] } });
    expectStatus(add, 200);
    assert(add.json.added === 1, { endpoint: add.endpoint, error: `added=${add.json.added}` });
    const list = await http("GET", `/api/admin/collections/${created.collection}/products`, { session: admin });
    assert(ids(list).includes(created.product2!) && ids(list).length === ids(before).length + 1, { endpoint: list.endpoint, error: `expected ${ids(before).length + 1}, got ${ids(list).length}` });
    const remove = await http("DELETE", `/api/admin/collections/${created.collection}/products`, { session: admin, body: { productId: created.product2 } });
    expectStatus(remove, 200);
    const after = await http("GET", `/api/admin/collections/${created.collection}/products`, { session: admin });
    assert(!ids(after).includes(created.product2!) && ids(after).length === ids(before).length, { endpoint: after.endpoint, error: "remove did not persist" });
    const inPublic = await http("GET", `/api/public/products?collection=${collectionSlug}&search=${encodeURIComponent(RUN)}`);
    assert(!inPublic.json.data.items.some((p: Json) => p.id === created.product2), { endpoint: inPublic.endpoint, error: "removed product still in public collection filter" });
    return `before: ${ids(before).length} (test product + its duplicate); POST add → 200 (added=1, now ${ids(list).length}); DELETE → 200 (back to ${ids(after).length}); public collection filter agrees`;
  });
  await step("Settings (read, and write back unchanged)", [role === "SUPER_ADMIN" ? true : null], async () => {
    const g = await http("GET", "/api/admin/settings", { session: admin });
    expectStatus(g, 200);
    // Writes the identical values back, so real store settings are not changed.
    const p = await http("PUT", "/api/admin/settings", { session: admin, body: g.json.settings });
    expectStatus(p, 200);
    assert(JSON.stringify(p.json.settings) === JSON.stringify(g.json.settings), { endpoint: p.endpoint, error: "settings changed" });
    return "GET → 200; PUT with identical values → 200 (no change)";
  });

  // ----------------------------------------------------------------- authorization
  console.log("\nAuthorization (roles)");
  let limited: Session | undefined;
  await step("SUPER_ADMIN can manage admin users", [role === "SUPER_ADMIN" ? true : null], async () => {
    const list = await http("GET", "/api/admin/users", { session: admin });
    expectStatus(list, 200);
    assert(!/passwordHash|\$2[aby]\$/.test(list.text), { endpoint: list.endpoint, error: "password hash leaked" });
    const password = `ApiTest-${Math.random().toString(36).slice(2, 10)}A9`;
    const email = `${run}@example.test`;
    const create = await http("POST", "/api/admin/users", { session: admin, body: { name: `API Test Admin ${RUN}`, email, password, confirmPassword: password, role: "ADMIN" } });
    expectStatus(create, 201);
    created.adminUser = create.json.user.id;
    const s = await signIn(email, password);
    assert(s.session.hasSession(), { endpoint: "POST /api/auth/callback/credentials", error: "temporary ADMIN could not sign in" });
    limited = s.session;
    const edit = await http("PATCH", `/api/admin/users/${created.adminUser}`, { session: admin, body: { name: `API Test Admin ${RUN} edited`, email, role: "ADMIN" } });
    expectStatus(edit, 200);
    const newPassword = `ApiTest-${Math.random().toString(36).slice(2, 10)}B8`;
    const reset = await http("POST", `/api/admin/users/${created.adminUser}/password`, { session: admin, body: { password: newPassword, confirmPassword: newPassword } });
    expectStatus(reset, 200);
    assert(!reset.text.includes(newPassword), { endpoint: reset.endpoint, error: "password echoed" });
    const re = await signIn(email, newPassword);
    limited = re.session;
    return `GET users → 200 (no hashes); POST temporary ADMIN → 201 id=${created.adminUser}; PATCH → 200; password reset → 200 (not echoed); ADMIN signs in with new password`;
  });
  await step("ADMIN cannot manage admin users or settings", [limited], async () => {
    const out: string[] = [];
    for (const [m, p, body] of [
      ["GET", "/api/admin/users"],
      ["POST", "/api/admin/users", { name: "x", email: `${run}-2@example.test`, password: "Xx-12345678", confirmPassword: "Xx-12345678", role: "SUPER_ADMIN" }],
      ["PATCH", `/api/admin/users/${created.adminUser}`, { name: "x", email: `${run}@example.test`, role: "SUPER_ADMIN" }],
      ["GET", "/api/admin/settings"],
      ["PUT", "/api/admin/settings", {}],
    ] as [string, string, unknown?][]) {
      const r = await http(m, p, { session: limited, body });
      assert(r.status === 403, { endpoint: `${m} ${p}`, expected: "403", received: String(r.status), error: apiError(r) });
      out.push(`${m} ${p.replace(/[a-f0-9]{24}/, "[id]")} → 403`);
    }
    const catalog = await http("GET", `/api/admin/products?q=${encodeURIComponent(RUN)}`, { session: limited });
    expectStatus(catalog, 200);
    out.push("GET /api/admin/products → 200 (catalog allowed)");
    return out.join("; ");
  });
  await step("Deactivated admin loses access immediately", [limited, created.adminUser], async () => {
    const off = await http("PATCH", `/api/admin/users/${created.adminUser}/status`, { session: admin, body: { isActive: false } });
    expectStatus(off, 200);
    const r = await http("GET", "/api/admin/me", { session: limited });
    assert(r.status === 401, { endpoint: "GET /api/admin/me", expected: "401", received: String(r.status) });
    return "PATCH status isActive=false → 200; the ADMIN's existing session → 401";
  });

  // ----------------------------------------------------------------- CSRF
  await step("Cross-site write is blocked (Origin check)", [admin], async () => {
    const r = await http("POST", "/api/admin/categories", { session: admin, body: taxonomy(`API Test CSRF ${RUN}`), origin: "https://evil.example" });
    assert(r.status === 403, { endpoint: r.endpoint, expected: "403", received: String(r.status) });
    return "POST with foreign Origin → 403";
  });

  // ----------------------------------------------------------------- deletion rules
  console.log("\nDeletion");
  await step("Category with products cannot be deleted", [created.category, created.product], async () => {
    const r = await http("DELETE", `/api/admin/categories/${created.category}`, { session: admin });
    expectStatus(r, 409, undefined, "DELETE /api/admin/categories/[id]");
    const still = await http("GET", `/api/admin/categories/${created.category}`, { session: admin });
    expectStatus(still, 200);
    return `HTTP 409 "${r.json.error}"; category still exists`;
  });
  await step("Image in use cannot be deleted", [created.media, created.product], async () => {
    const r = await http("DELETE", `/api/admin/media/${created.media}`, { session: admin });
    expectStatus(r, 409, undefined, "DELETE /api/admin/media/[id]");
    return `HTTP 409 "${r.json.error}"`;
  });
  await step("Delete Product", [created.product], async () => {
    const r = await http("DELETE", `/api/admin/products/${created.product}`, { session: admin });
    expectStatus(r, 200);
    const g = await http("GET", `/api/admin/products/${created.product}`, { session: admin });
    expectStatus(g, 404, undefined, "GET /api/admin/products/[id]");
    const pub = await http("GET", `/api/public/products/${productSlug}`);
    expectStatus(pub, 404, undefined, "GET /api/public/products/[slug]");
    const deletedId = created.product;
    created.product = undefined; // already removed
    return `DELETE → 200; admin GET ${deletedId} → 404; public GET by slug → 404`;
  });
}

// ---------------------------------------------------------------------------
// Cleanup: only ids captured in this run, and only if the record still carries the run id
// ---------------------------------------------------------------------------

async function cleanup() {
  const line = "=".repeat(48);
  console.log(`\n${line}\nTEST DATA CREATED (run ${RUN})\n${line}`);
  const labels: [string, string][] = [
    ["product", "Product"],
    ["product2", "Product (Cake Box)"],
    ["product3", "Product (duplicate)"],
    ["media", "Image"],
    ["subcategory", "Subcategory"],
    ["category", "Category"],
    ["brand", "Brand"],
    ["collection", "Collection"],
    ["occasion", "Occasion"],
    ["adminUser", "Temporary ADMIN user"],
  ];
  for (const [k, label] of labels) if (created[k]) console.log(`${label.padEnd(22)} ${created[k]}`);
  for (const u of unexpected) console.log(`${("Unexpected " + u.kind).padEnd(22)} ${u.id}  (created by a request that should have been rejected)`);
  if (!admin) return;

  console.log("\nCleanup");
  const verifyAndDelete = async (label: string, getPath: string, nameOf: (j: Json) => string | undefined, deletePath: string) => {
    const g = await http("GET", getPath, { session: admin });
    if (g.status === 404) return;
    const name = nameOf(g.json) ?? "";
    assert(g.status === 200 && name.includes(RUN), { endpoint: g.endpoint, error: `refusing to delete ${label}: record does not carry run id` });
    const d = await http("DELETE", deletePath, { session: admin });
    expectStatus(d, 200);
    const after = await http("GET", getPath, { session: admin });
    assert(after.status === 404, { endpoint: after.endpoint, expected: "404 after delete", received: String(after.status) });
  };

  for (const u of unexpected) {
    await step(`Cleanup: delete wrongly-created ${u.kind} record`, [true], async () =>
      verifyAndDelete(u.kind, `/api/admin/${u.kind}/${u.id}`, (j) => j?.values?.name ?? j?.item?.name, `/api/admin/${u.kind}/${u.id}`).then(() => `${u.id} deleted`),
    );
  }
  for (const k of ["product", "product2", "product3"]) {
    const id = created[k];
    if (id) await step(`Cleanup: delete ${k}`, [true], async () => verifyAndDelete(k, `/api/admin/products/${id}`, (j) => j?.values?.name, `/api/admin/products/${id}`).then(() => `${id} deleted (verified 404)`));
  }
  if (created.media) {
    await step("Cleanup: delete image", [true], async () => {
      const list = await http("GET", `/api/admin/media?q=${encodeURIComponent(RUN)}`, { session: admin });
      const mine = list.json?.items?.find((m: Json) => m.id === created.media);
      assert(mine && mine.filename.includes(RUN), { endpoint: list.endpoint, error: "refusing to delete image: not found by run id" });
      const d = await http("DELETE", `/api/admin/media/${created.media}`, { session: admin });
      expectStatus(d, 200);
      return `${created.media} deleted`;
    });
  }
  for (const [k, kind] of [
    ["subcategory", "subcategories"],
    ["category", "categories"],
    ["brand", "brands"],
    ["collection", "collections"],
    ["occasion", "occasions"],
  ] as const) {
    const id = created[k];
    if (id) await step(`Cleanup: delete ${k}`, [true], async () => verifyAndDelete(k, `/api/admin/${kind}/${id}`, (j) => j?.item?.name, `/api/admin/${kind}/${id}`).then(() => `${id} deleted (verified 404)`));
  }
  if (created.adminUser) {
    await step("Cleanup: delete temporary ADMIN user", [true], async () => {
      const list = await http("GET", "/api/admin/users", { session: admin });
      const u = list.json?.users?.find((x: Json) => x.id === created.adminUser);
      assert(u && u.email === `${run}@example.test`, { endpoint: list.endpoint, error: "refusing to delete user: email does not carry run id" });
      const d = await http("DELETE", `/api/admin/users/${created.adminUser}`, { session: admin });
      expectStatus(d, 200);
      return `${created.adminUser} deleted`;
    });
  }
  await step("Cleanup verified: no records with the run id remain", [true], async () => {
    const leftovers: string[] = [];
    const p = await http("GET", `/api/admin/products?q=${encodeURIComponent(RUN)}`, { session: admin });
    if (p.json?.total) leftovers.push(`${p.json.total} products`);
    for (const kind of ["categories", "subcategories", "brands", "collections", "occasions"]) {
      const r = await http("GET", `/api/admin/${kind}?q=${encodeURIComponent(RUN)}`, { session: admin });
      if (r.json?.items?.length) leftovers.push(`${r.json.items.length} ${kind}`);
    }
    const m = await http("GET", `/api/admin/media?q=${encodeURIComponent(RUN)}`, { session: admin });
    if (m.json?.total) leftovers.push(`${m.json.total} images`);
    assert(leftovers.length === 0, { error: `left behind: ${leftovers.join(", ")}` });
    return "products, categories, subcategories, brands, collections, occasions, images: 0 remaining";
  });
}

// ---------------------------------------------------------------------------

async function report() {
  const tests = outcomes.filter((o) => !o.name.startsWith("Cleanup:"));
  const passed = outcomes.filter((o) => o.status === "pass").length;
  const failed = outcomes.filter((o) => o.status === "fail").length;
  const skipped = outcomes.filter((o) => o.status === "skip").length;
  const line = "=".repeat(48);
  console.log(`\n${line}\nENDPOINTS EXERCISED\n${line}`);
  for (const [k, v] of [...endpointResults].sort()) console.log(`${v === "PASS" ? "✓" : "✗"} ${k}`);
  console.log(`\n${line}\nRESULT\n${line}`);
  console.log(`Tests:   ${tests.length} (+${outcomes.length - tests.length} cleanup steps)`);
  console.log(`Passed:  ${passed}`);
  console.log(`Failed:  ${failed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`\nBackend API Status: ${failed === 0 && skipped === 0 ? "HEALTHY" : failed === 0 ? "HEALTHY (with skipped checks)" : "UNHEALTHY"}\n${line}`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => console.error(`\nUnexpected error: ${e instanceof Error ? e.message : e}`))
  .finally(async () => {
    try {
      await cleanup();
    } catch (e) {
      console.error(`Cleanup error: ${e instanceof Error ? e.message : e}`);
    }
    await report();
  });
