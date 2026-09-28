# Backend API smoke test

`npm run test:api` (source: [`scripts/api-smoke-test.ts`](../scripts/api-smoke-test.ts)) tests every current HTTP API of
the admin app **through the API itself**. Test data is created, changed and deleted with real requests; the script
never writes to MongoDB directly.

## Running it

Add these to `.env.local`. They are server-only; never prefix them with `NEXT_PUBLIC_`:

```
API_TEST_BASE_URL=http://localhost:3001
API_TEST_ADMIN_EMAIL=<an existing admin, SUPER_ADMIN recommended>
API_TEST_ADMIN_PASSWORD=<its password>
```

Then start the app (`npm run dev` or `npm start`) and run `npm run test:api`. The exit code is 0 when healthy and 1 on
any failure.

### Safety

- Every record is named with a unique run id (`API_TEST_<timestamp>`), e.g. `API Test Category API_TEST_1790592841594`.
- The IDs created are printed before cleanup. Cleanup deletes **only** those IDs, and only after re-reading each record
  and confirming its name, file name or email still contains the run id.
- A request that should have been rejected but returned 201 (a bug) has its record tracked and deleted too.
- Real data is never modified. Settings are read and written back **unchanged**. The temporary ADMIN user is created,
  tested and deleted.
- Non-local targets are refused unless `API_TEST_ALLOW_REMOTE=true` is set.
- Passwords, cookies, tokens and connection strings are never printed.
- The wrong-password check runs *before* the real login, so repeated runs can't lock the account (a successful login
  resets the failed-attempt counter).
- As a SUPER_ADMIN the full suite runs. As an ADMIN, the Settings and admin-user steps are reported as **SKIPPED**,
  not passed.

## Latest result

Run `API_TEST_1790592841594` against a production build (`next start`) on a fresh, throwaway MongoDB that also
contained real (non-test) records:

```
Tests:   47 (+9 cleanup steps)
Passed:  56
Failed:  0
Skipped: 0
Backend API Status: HEALTHY
```

The real records (category "Sprinkles", product "Real Gold Pearls", the owner admin) were unchanged afterwards. A
second run was also 56/56. After the run, the unique indexes `slug`, `sku` and `variants.sku` existed on `products`.

## Bug found and fixed

| | |
|---|---|
| **Symptom** | "Duplicate SKU" failed: `POST /api/admin/products` with an existing SKU returned **201** instead of 409, and a second product with the same SKU was saved. |
| **Cause** | `src/lib/db.ts` set `autoIndex: NODE_ENV !== "production"`. Under `next start` Mongoose never created the collection indexes, including the **unique** indexes on `sku`, `variants.sku` and `slug`. The older catalog test hid this, because its script loaded the models itself (in non-production mode), which created the indexes as a side effect. |
| **Fix** | (1) `autoIndex: true` always (creating an index that already exists is a no-op). (2) `buildProductData` now checks product and option SKUs before saving and returns 409 "A product with this SKU already exists.". (3) `npm run db:check` creates missing indexes for all 12 collections (additive only, never drops). |
| **Verified** | Re-run on a brand-new database with a production build: Duplicate SKU → 409, exactly one product with the SKU, and the unique indexes exist. |

One test-side correction: the "Collection product assignment" step first expected a fixed count of 2. The earlier
Duplicate step correctly copies the product's collections, so the collection already held 2 products. The assertion
now compares before/after counts (+1 after add, back to the original after remove) and also checks the public
collection filter. The API behaviour was correct and unchanged.

## Endpoints

Auth column: **Public** = no login; **Session** = any signed-in admin; **Catalog** = `catalog:*` permission
(SUPER_ADMIN and ADMIN); **Media** = `media:*` (both roles); **Super** = SUPER_ADMIN only.

| Endpoint | Method | Auth | Purpose | Tested | Result |
|---|---|---|---|---|---|
| `/api/auth/csrf` → `/api/auth/callback/credentials` | GET, POST | Public | Auth.js login (sets httpOnly session cookie) | ✓ valid + wrong password | PASS |
| `/api/auth/session` | GET | Public | Current session (no password data) | ✓ | PASS |
| `/api/auth/signout` | POST | Session | Logout | covered by `npm run test:auth` | PASS (other suite) |
| `/api/auth/register` | POST | Public | First-admin registration (closed once an admin exists) | ✓ expects 403 | PASS |
| `/api/admin/me` | GET | Session | Signed-in admin | ✓ | PASS |
| `/api/admin/products` | GET | Catalog | List: search, filters, sort, pagination | ✓ | PASS |
| `/api/admin/products` | POST | Catalog | Create product | ✓ + validation + duplicate SKU | PASS (after fix) |
| `/api/admin/products/[id]` | GET | Catalog | Product for editing | ✓ | PASS |
| `/api/admin/products/[id]` | PUT | Catalog | Save product (incl. variants, images) | ✓ | PASS |
| `/api/admin/products/[id]` | PATCH | Catalog | Publish/unpublish, featured | ✓ | PASS |
| `/api/admin/products/[id]` | DELETE | Catalog | Delete product | ✓ | PASS |
| `/api/admin/products/[id]/duplicate` | POST | Catalog | Copy as draft without SKU | ✓ | PASS |
| `/api/admin/products/lookup` | GET | Catalog | Product picker search | ✓ | PASS |
| `/api/admin/{categories,subcategories,brands,collections,occasions}` | GET, POST | Catalog | List / create | ✓ all 5 | PASS |
| `/api/admin/{…}/[id]` | GET, PUT, PATCH, DELETE | Catalog | Read / update / activate / delete | ✓ all 5 | PASS |
| `/api/admin/{…}/reorder` | POST | Catalog | Display order (test records only) | ✓ all 5 | PASS |
| `/api/admin/collections/[id]/products` | GET, POST, DELETE | Catalog | Collection ↔ product assignment | ✓ | PASS |
| `/api/admin/media` | GET, POST | Media | Image library / upload | ✓ + non-image rejected | PASS |
| `/api/admin/media/[id]` | DELETE | Media | Delete unused image (in-use → 409) | ✓ | PASS |
| `/media/[...key]` | GET | Public | Serve locally stored image | ✓ | PASS |
| `/api/admin/settings` | GET, PUT | Super | Store settings (written back unchanged) | ✓ | PASS |
| `/api/admin/users` | GET, POST | Super | Admin users | ✓ | PASS |
| `/api/admin/users/[id]` | PATCH, DELETE | Super | Edit / delete admin (temporary user only) | ✓ | PASS |
| `/api/admin/users/[id]/status` | PATCH | Super | Activate / deactivate | ✓ | PASS |
| `/api/admin/users/[id]/password` | POST | Super | Reset password | ✓ | PASS |
| `/api/public/products` | GET | Public | Search, filters, sort, pagination | ✓ | PASS |
| `/api/public/products/[slug]` | GET | Public | Product by slug (published only) | ✓ | PASS |
| `/api/public/{categories,subcategories,collections,occasions,brands}` | GET | Public | Lists | ✓ all 5 | PASS |
| `/api/public/{…}/[slug]` | GET | Public | Single record | ✓ all 5 | PASS |
| `/api/public/store` | GET | Public | Store info | ✓ | PASS |
| `/api/public/*` | OPTIONS | Public | CORS preflight (unknown origin not allowed) | ✓ | PASS |
| `/api/health` | – | – | Health check | – | **NOT IMPLEMENTED** (liveness uses `GET /api/public/categories`) |

## What each test step checks

| Step | Evidence recorded (latest run) |
|---|---|
| Authentication | HTTP 302 → /admin, session cookie, `/api/admin/me` 200 role SUPER_ADMIN, no hash in responses |
| Unauthorized requests | GET/POST/PUT/DELETE on products, POST categories, GET users, POST media, PUT settings → all **401** |
| Create/Get Category, Subcategory, Brand, Collection, Occasion | 201 + id + slug + isActive; GET by id; subcategory GET returns its parent category |
| Every catalog group | list `?q=`, PUT (persisted), PATCH off/on, reorder for all 5 kinds |
| Image upload | 201, converted to WebP 800×800, file served, listed; a fake PNG is rejected with 415 |
| Create Product (draft) | 201; price ₹180, sale ₹150, stock 25, stockStatus `in_stock`, featured, newArrival |
| Product Relationships | category/subcategory/brand/collection/occasion/image ids match, and each resolves by its own GET |
| Draft hidden → Publish | public GET by slug 404 while draft; PATCH published → public 200, same id |
| Update Product | price 200, stock 20, description persisted (admin GET and public API) |
| Variants | 100g ₹180×10, 250g ₹320×15 saved with ids; product stock derived 25; public shows 2 options, from ₹180 |
| Search / filters | exact search → 1 result; category, subcategory, collection and occasion filters return only matching products; featured and new arrival correct |
| Pagination / sorting | `page=1&pageSize=10` meta correct; pageSize=1 pages 1 and 2 have no overlap; price_asc ₹50 < ₹180, desc reversed |
| Validation | missing name, invalid price, sale ≥ price, malformed or non-existent category, publish without SKU, category without name, subcategory without parent → **422**, none saved |
| Duplicate SKU | **409** "A product with this SKU already exists."; exactly one product with that SKU; duplicate option SKU → 409 |
| Roles | SUPER_ADMIN manages users; temporary ADMIN → 403 on users and settings, 200 on catalog; deactivated → 401 |
| CSRF | write with a foreign `Origin` → 403 |
| Delete rules | category with products → 409; image in use → 409; product delete → admin 404 and public 404 |
| Cleanup | 9 records deleted (each verified 404); a final search for the run id finds 0 records of any type |
