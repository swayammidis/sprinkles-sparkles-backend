/**
 * End-to-end API test against a running server + seeded database.
 *
 *   TEST_BASE_URL=http://localhost:3001 TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... npm run test:api
 *
 * Creates its own records (prefixed "e2e-"/"E2E-") and deletes them afterwards.
 * The TEST_ADMIN account must be a SUPER_ADMIN.
 */
import "dotenv/config";
import sharp from "sharp";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3001";
const ORIGIN = new URL(BASE).origin;
const EMAIL = process.env.TEST_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "";
const RUN = Date.now().toString(36);

let passed = 0;
let failed = 0;
const cleanups: (() => Promise<unknown>)[] = [];

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : "");
  }
}

type Res = { status: number; json: any; headers: Headers }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function req(path: string, opts: { method?: string; body?: unknown; cookie?: string; origin?: string | null; form?: FormData; redirect?: RequestRedirect } = {}): Promise<Res> {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    redirect: opts.redirect ?? "follow",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { status: res.status, cookie };
}

async function png(color: string) {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: color } }).png().toBuffer();
}

async function upload(cookie: string, bytes: Uint8Array, name: string, type = "image/png") {
  const fd = new FormData();
  fd.append("file", new Blob([bytes as BlobPart], { type }), name);
  fd.append("folder", "products");
  return req("/api/admin/uploads", { method: "POST", cookie, form: fd });
}

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error("Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD");
  console.log(`Testing ${BASE}\n`);

  // -------------------------------------------------------------------------
  console.log("Protected routes (unauthenticated)");
  const adminPage = await req("/admin", { redirect: "manual" });
  check("GET /admin redirects to /login", adminPage.status === 307 && (adminPage.headers.get("location") ?? "").includes("/login"), adminPage.status);
  const noAuthList = await req("/api/admin/products");
  check("GET /api/admin/products → 401", noAuthList.status === 401, noAuthList.status);
  const noAuthCreate = await req("/api/admin/products", { method: "POST", body: { name: "x" } });
  check("POST /api/admin/products → 401", noAuthCreate.status === 401, noAuthCreate.status);
  const forged = await req("/api/admin/products", { cookie: "ss-admin.session_token=forged.value" });
  check("Forged session cookie → 401", forged.status === 401, forged.status);
  const signUp = await req("/api/auth/sign-up/email", { method: "POST", body: { email: `x${RUN}@e2e.test`, password: "Password12345", name: "x" } });
  check("Public sign-up is disabled", signUp.status >= 400, signUp.status);

  // -------------------------------------------------------------------------
  console.log("\nAdmin login");
  const bad = await signIn(EMAIL, "wrong-password-123");
  check("Wrong password rejected", bad.status === 401, bad.status);
  const { status: loginStatus, cookie } = await signIn(EMAIL, PASSWORD);
  check("Super admin can sign in", loginStatus === 200 && cookie.includes("ss-admin"), loginStatus);
  const dash = await req("/admin", { cookie, redirect: "manual" });
  check("GET /admin with session → 200", dash.status === 200, dash.status);

  const csrf = await req("/api/admin/categories", { method: "POST", cookie, origin: "https://evil.example", body: {} });
  check("Cross-origin mutation blocked (CSRF) → 403", csrf.status === 403, csrf.status);

  // -------------------------------------------------------------------------
  console.log("\nCategories");
  const catBody = { name: `E2E Category ${RUN}`, slug: `e2e-category-${RUN}`, description: "", image: "", active: true, categoryId: "" };
  const cat = await req("/api/admin/categories", { method: "POST", cookie, body: catBody });
  check("Create category → 201", cat.status === 201, cat.json);
  const catId: string = cat.json?.item?.id;
  cleanups.push(() => req(`/api/admin/categories/${catId}`, { method: "DELETE", cookie }));
  const dupCat = await req("/api/admin/categories", { method: "POST", cookie, body: catBody });
  check("Duplicate slug → 409", dupCat.status === 409, dupCat.status);
  const badCat = await req("/api/admin/categories", { method: "POST", cookie, body: { ...catBody, slug: "Not A Slug!" } });
  check("Invalid slug → 422 with field error", badCat.status === 422 && !!badCat.json?.error?.fieldErrors?.slug, badCat.json);

  const sub = await req("/api/admin/subcategories", {
    method: "POST",
    cookie,
    body: { name: `E2E Sub ${RUN}`, slug: `e2e-sub-${RUN}`, description: "", image: "", active: true, categoryId: catId },
  });
  check("Create subcategory → 201", sub.status === 201, sub.json);
  const subId: string = sub.json?.item?.id;
  cleanups.unshift(() => req(`/api/admin/subcategories/${subId}`, { method: "DELETE", cookie }));

  const collections = await req("/api/admin/collections", { cookie });
  const featuredCollection = collections.json?.items?.find((c: { slug: string }) => c.slug === "featured");

  // -------------------------------------------------------------------------
  console.log("\nImage uploads");
  const up1 = await upload(cookie, await png("#e2508a"), "pink.png");
  check("Upload PNG → 201", up1.status === 201 && !!up1.json?.asset?.url, up1.json);
  const up2 = await upload(cookie, await png("#14a39a"), "teal.png");
  const media1: string = up1.json?.asset?.id;
  const media2: string = up2.json?.asset?.id;
  const fake = await upload(cookie, new TextEncoder().encode("<script>alert(1)</script>".padEnd(64, " ")), "evil.png");
  check("Non-image disguised as .png rejected → 415", fake.status === 415, fake.status);
  const svg = await upload(cookie, new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "x.svg", "image/svg+xml");
  check("SVG rejected", svg.status === 415, svg.status);
  const served = await fetch(new URL(up1.json.asset.url, BASE));
  check("Uploaded file served with nosniff", served.status === 200 && served.headers.get("x-content-type-options") === "nosniff", served.status);

  // -------------------------------------------------------------------------
  console.log("\nCreate product with variants");
  const sku = `E2E-${RUN}`.toUpperCase();
  const productBody = {
    name: `E2E Sprinkles ${RUN}`,
    slug: `e2e-sprinkles-${RUN}`,
    sku,
    shortDescription: "Test product",
    description: "",
    price: "200.00",
    salePrice: "",
    stockQuantity: 999, // must be ignored: derived from variants
    stockStatus: "IN_STOCK",
    categoryId: catId,
    subcategoryId: subId,
    brandId: "",
    collectionIds: featuredCollection ? [featuredCollection.id] : [],
    occasionIds: [],
    images: [{ mediaAssetId: media1, altText: "Pink", isPrimary: true, url: "https://evil.example/x.png" }],
    hasVariants: true,
    variants: [
      { name: "100g", sku: `${sku}-100`, price: "200.00", salePrice: "", stockQuantity: 5, weight: "100", active: true, imageMediaAssetId: media1, attributes: [{ name: "Weight", value: "100g" }] },
      { name: "250g", sku: `${sku}-250`, price: "450.00", salePrice: "399.50", stockQuantity: 7, weight: "250", active: true, imageMediaAssetId: "", attributes: [{ name: "Weight", value: "250g" }, { name: "Colour", value: "Pink" }] },
    ],
    weight: "",
    length: "",
    width: "",
    height: "",
    active: true,
    featured: true,
    newArrival: false,
    bestSeller: false,
    seoTitle: "",
    seoDescription: "",
    seoImage: "",
    isDemo: true, // unknown field: must be stripped
    effectivePrice: "0.01", // server-derived: must be ignored
  };

  const invalid = await req("/api/admin/products", { method: "POST", cookie, body: { ...productBody, salePrice: "250.00" } });
  check("Sale price ≥ price rejected server-side → 422", invalid.status === 422 && !!invalid.json?.error?.fieldErrors?.salePrice, invalid.json);
  const badPrice = await req("/api/admin/products", { method: "POST", cookie, body: { ...productBody, price: "12.345" } });
  check("Invalid money format rejected → 422", badPrice.status === 422, badPrice.status);
  const negStock = await req("/api/admin/products", { method: "POST", cookie, body: { ...productBody, hasVariants: false, variants: [], stockQuantity: -5 } });
  check("Negative stock rejected → 422", negStock.status === 422, negStock.status);
  const wrongSub = await req("/api/admin/products", { method: "POST", cookie, body: { ...productBody, subcategoryId: "does-not-exist" } });
  check("Unknown subcategory rejected → 400", wrongSub.status === 400, wrongSub.json);

  const created = await req("/api/admin/products", { method: "POST", cookie, body: productBody });
  check("Create product → 201", created.status === 201, created.json);
  const productId: string = created.json?.id;
  cleanups.unshift(() => req(`/api/admin/products/${productId}`, { method: "DELETE", cookie }));

  const loaded = await req(`/api/admin/products/${productId}`, { cookie });
  const v = loaded.json?.values;
  check("Stock derived from variants (5+7=12), client value ignored", v?.stockQuantity === 12, v?.stockQuantity);
  check("Variants saved with attributes", v?.variants?.length === 2 && v.variants[1].attributes.length === 2, v?.variants);
  check("Image URL taken from media library, not client", v?.images?.[0]?.url === up1.json.asset.url, v?.images);
  check("Assigned category/subcategory", v?.categoryId === catId && v?.subcategoryId === subId);

  // -------------------------------------------------------------------------
  console.log("\nEdit product: images, primary, stock, SEO");
  const updateBody = {
    ...v,
    images: [
      { id: v.images[0].id, mediaAssetId: media1, altText: "Pink", isPrimary: false },
      { mediaAssetId: media2, altText: "Teal", isPrimary: true },
    ].reverse(), // teal first, and primary
    variants: v.variants.map((x: { stockQuantity: number }, i: number) => ({ ...x, stockQuantity: i === 0 ? 1 : 2 })),
    seoTitle: "E2E SEO title",
    seoDescription: "E2E meta",
    seoImage: media2,
  };
  const updated = await req(`/api/admin/products/${productId}`, { method: "PUT", cookie, body: updateBody });
  check("Update product → 200", updated.status === 200, updated.json);
  const reloaded = (await req(`/api/admin/products/${productId}`, { cookie })).json;
  check("Second image is primary & first in order", reloaded?.values?.images?.[0]?.mediaAssetId === media2 && reloaded.values.images[0].isPrimary === true && reloaded.values.images[1].isPrimary === false, reloaded?.values?.images);
  check("Stock updated (1+2=3)", reloaded?.values?.stockQuantity === 3, reloaded?.values?.stockQuantity);
  check("SEO saved", reloaded?.values?.seoTitle === "E2E SEO title" && reloaded?.seoImageUrl === up2.json.asset.url);
  const twoPrimary = await req(`/api/admin/products/${productId}`, {
    method: "PUT",
    cookie,
    body: { ...reloaded.values, images: reloaded.values.images.map((i: object) => ({ ...i, isPrimary: true })) },
  });
  check("Two primary images rejected → 422", twoPrimary.status === 422, twoPrimary.status);

  // -------------------------------------------------------------------------
  console.log("\nPublic API");
  const pub = await req(`/api/public/products/${productBody.slug}`, { origin: "http://localhost:3000" });
  check("Active product visible publicly", pub.status === 200, pub.status);
  const d = pub.json?.data;
  const leaked = ["stockQuantity", "isDemo", "effectivePrice", "createdAt", "updatedAt", "categoryId"].filter((k) => d && k in d);
  check("No internal fields in public DTO", leaked.length === 0 && !JSON.stringify(d).includes("stockQuantity"), leaked);
  check("fromPrice = cheapest variant price (200.00)", d?.fromPrice === "200.00", d?.fromPrice);
  check("Money serialised as decimal strings", d?.variants?.[1]?.salePrice === "399.50", d?.variants?.[1]);
  check("Variant attributes as map", d?.variants?.[1]?.attributes?.Colour === "Pink", d?.variants?.[1]?.attributes);
  check("Primary image first", d?.image?.url === up2.json.asset.url, d?.image);
  check("CORS allowed for storefront origin", pub.headers.get("access-control-allow-origin") === "http://localhost:3000");
  const evilCors = await req(`/api/public/products`, { origin: "https://evil.example" });
  check("CORS not granted to unknown origin", !evilCors.headers.get("access-control-allow-origin"));

  const search = await req(`/api/public/products?search=${encodeURIComponent(`E2E Sprinkles ${RUN}`)}`);
  check("Search finds product", search.json?.data?.items?.some((p: { slug: string }) => p.slug === productBody.slug), search.json?.data?.pagination);
  const byCat = await req(`/api/public/categories/${catBody.slug}/products`);
  check("Products by category", byCat.json?.data?.products?.items?.length === 1, byCat.json);
  const bySub = await req(`/api/public/subcategories/e2e-sub-${RUN}/products`);
  check("Products by subcategory", bySub.json?.data?.products?.items?.length === 1, bySub.status);
  const featured = await req(`/api/public/products?featured=true&pageSize=48`);
  check("Featured filter includes product", featured.json?.data?.items?.some((p: { slug: string }) => p.slug === productBody.slug));
  const coll = await req(`/api/public/collections/featured/products?pageSize=48`);
  check("Collection products", coll.json?.data?.products?.items?.some((p: { slug: string }) => p.slug === productBody.slug), coll.status);
  const occ = await req(`/api/public/occasions/birthday/products`);
  check("Occasion products endpoint", occ.status === 200 && Array.isArray(occ.json?.data?.products?.items), occ.status);
  const newArr = await req(`/api/public/products?newArrival=true`);
  check("New arrivals filter", newArr.status === 200 && newArr.json.data.items.every((p: { badges: { newArrival: boolean } }) => p.badges.newArrival));
  const price = await req(`/api/public/products?minPrice=100&maxPrice=250&sort=price_asc&pageSize=48`);
  const prices = (price.json?.data?.items ?? []).map((p: { fromPrice: string }) => p.fromPrice);
  check(
    "Price filter + price_asc sort",
    prices.length > 0 && prices.every((p: string, i: number) => Number(p) >= 100 && Number(p) <= 250 && (i === 0 || Number(prices[i - 1]) <= Number(p))),
    prices,
  );
  const page1 = await req(`/api/public/products?pageSize=2&page=1&sort=name_asc`);
  const page2 = await req(`/api/public/products?pageSize=2&page=2&sort=name_asc`);
  check(
    "Pagination returns distinct pages",
    page1.json?.data?.items?.length === 2 && page2.json?.data?.items?.[0]?.slug !== page1.json?.data?.items?.[0]?.slug && page1.json?.data?.pagination?.total >= 3,
    page1.json?.data?.pagination,
  );
  const draft = await req(`/api/public/products/cake-decorating-turntable`);
  check("Draft demo product hidden publicly", draft.status === 404, draft.status);
  const cats = await req(`/api/public/categories`);
  check("Public categories include subcategories", cats.json?.data?.some((c: { slug: string; subcategories: unknown[] }) => c.slug === catBody.slug && c.subcategories.length === 1));

  // -------------------------------------------------------------------------
  console.log("\nPublish / unpublish");
  const unpub = await req(`/api/admin/products/${productId}`, { method: "PATCH", cookie, body: { active: false } });
  check("Unpublish → 200", unpub.status === 200 && unpub.json?.active === false, unpub.json);
  const hidden = await req(`/api/public/products/${productBody.slug}`);
  check("Unpublished product hidden publicly", hidden.status === 404, hidden.status);
  await req(`/api/admin/products/${productId}`, { method: "PATCH", cookie, body: { active: true } });
  const inactiveCat = await req(`/api/admin/categories/${catId}`, { method: "PATCH", cookie, body: { active: false } });
  const hiddenByCat = await req(`/api/public/products/${productBody.slug}`);
  check("Deactivating category hides its products", inactiveCat.status === 200 && hiddenByCat.status === 404, hiddenByCat.status);
  await req(`/api/admin/categories/${catId}`, { method: "PATCH", cookie, body: { active: true } });
  const noPublicWrite = await req(`/api/public/products`, { method: "POST", body: productBody });
  check("Public API is read-only (POST → 405)", noPublicWrite.status === 405, noPublicWrite.status);

  // -------------------------------------------------------------------------
  console.log("\nAdmin list: search, filter, sort, pagination");
  const list = await req(`/api/admin/products?q=${encodeURIComponent(sku)}`, { cookie });
  check("Admin search by SKU", list.json?.items?.length === 1, list.json?.total);
  const listVariantSku = await req(`/api/admin/products?q=${encodeURIComponent(`${sku}-250`)}`, { cookie });
  check("Admin search by variant SKU", listVariantSku.json?.items?.length === 1);
  const lowStock = await req(`/api/admin/products?stock=low_stock&pageSize=100`, { cookie });
  check("Low stock filter", lowStock.json?.items?.every((p: { stockQuantity: number }) => p.stockQuantity > 0 && p.stockQuantity <= 5), lowStock.json?.items?.map((p: { stockQuantity: number }) => p.stockQuantity));
  const sorted = await req(`/api/admin/products?sort=price&dir=desc&pageSize=100`, { cookie });
  const listPrices = (sorted.json?.items ?? []).map((p: { price: string }) => Number(p.price));
  check("Sort by price desc", listPrices.length > 1 && listPrices.every((n: number, i: number) => i === 0 || listPrices[i - 1] >= n), listPrices);
  const paged = await req(`/api/admin/products?pageSize=5&page=2`, { cookie });
  check("Admin pagination", paged.json?.page === 2 && paged.json?.pageSize === 5, paged.json?.page);

  // -------------------------------------------------------------------------
  console.log("\nDuplicate & delete");
  const dup = await req(`/api/admin/products/${productId}/duplicate`, { method: "POST", cookie });
  check("Duplicate → 201", dup.status === 201, dup.json);
  const dupId: string = dup.json?.id;
  const dupLoaded = (await req(`/api/admin/products/${dupId}`, { cookie })).json;
  check("Duplicate is a draft with unique slug/SKU", dupLoaded?.values?.active === false && dupLoaded?.values?.slug !== productBody.slug && dupLoaded?.values?.sku !== sku);
  check("Duplicate copied variants & images", dupLoaded?.values?.variants?.length === 2 && dupLoaded?.values?.images?.length === 2);
  const catInUse = await req(`/api/admin/categories/${catId}`, { method: "DELETE", cookie });
  check("Deleting category in use → 409", catInUse.status === 409, catInUse.json);
  const mediaInUse = await req(`/api/admin/media/${media1}`, { method: "DELETE", cookie });
  check("Deleting image in use → 409", mediaInUse.status === 409, mediaInUse.status);
  const del = await req(`/api/admin/products/${dupId}`, { method: "DELETE", cookie });
  check("Delete product → 200", del.status === 200, del.status);
  const gone = await req(`/api/admin/products/${dupId}`, { cookie });
  check("Deleted product → 404", gone.status === 404, gone.status);

  // -------------------------------------------------------------------------
  console.log("\nRoles & authorization");
  const adminEmail = `e2e-admin-${RUN}@e2e.test`;
  const adminPassword = `E2eAdminPass${RUN}9`;
  const newAdmin = await req("/api/admin/users", { method: "POST", cookie, body: { name: "E2E Admin", email: adminEmail, password: adminPassword, role: "ADMIN" } });
  check("Super admin creates ADMIN user", newAdmin.status === 201, newAdmin.json);
  const adminId: string = newAdmin.json?.item?.id;
  const { cookie: adminCookie } = await signIn(adminEmail, adminPassword);
  check("ADMIN can read catalog", (await req("/api/admin/products", { cookie: adminCookie })).status === 200);
  const adminUsers = await req("/api/admin/users", { cookie: adminCookie });
  check("ADMIN cannot manage admins → 403", adminUsers.status === 403, adminUsers.status);
  const escalate = await req("/api/auth/update-user", { method: "POST", cookie: adminCookie, body: { role: "SUPER_ADMIN", active: true, name: "E2E Admin" } });
  const afterEscalate = await req("/api/admin/users", { cookie: adminCookie });
  check("ADMIN cannot self-promote via auth API", afterEscalate.status === 403, { escalate: escalate.status, after: afterEscalate.status });
  const selfDemote = await req(`/api/admin/users/${adminId}`, { method: "PATCH", cookie: adminCookie, body: { role: "SUPER_ADMIN" } });
  check("ADMIN cannot PATCH roles → 403", selfDemote.status === 403, selfDemote.status);
  await req(`/api/admin/users/${adminId}`, { method: "PATCH", cookie, body: { active: false } });
  const deactivated = await req("/api/admin/products", { cookie: adminCookie });
  check("Deactivated admin loses access immediately → 401", deactivated.status === 401, deactivated.status);
  const relogin = await signIn(adminEmail, adminPassword);
  check("Deactivated admin cannot sign in", relogin.status !== 200, relogin.status);

  // -------------------------------------------------------------------------
  console.log("\nCleanup");
  for (const fn of cleanups) await fn();
  for (const id of [media1, media2]) await req(`/api/admin/media/${id}`, { method: "DELETE", cookie });
  console.log(`  (removed e2e records; deactivated e2e admin ${adminEmail} kept for audit)`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error(e);
  for (const fn of cleanups) await fn().catch(() => {});
  process.exitCode = 1;
});
