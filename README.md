# Sprinkle & Sparkle — Admin

The custom admin panel for Sprinkle & Sparkle, built with Next.js 16, TypeScript, MongoDB Atlas (Mongoose),
Auth.js v5 and Tailwind with shadcn/ui.

**Status:** authentication, admin users and the complete **catalog** (products with images and variants,
categories, subcategories, collections, occasions, brands, media library, store settings), plus a public read-only
API for the customer website. Orders, customers, coupons, shipping and payments are shown as "Coming soon".

> The previous PostgreSQL/Prisma implementation is preserved on the git branch `postgres-prisma-snapshot`.

## Setup

```bash
npm install
cp .env.example .env.local        # then fill in the values (see below)
npm run db:check                  # verifies the MongoDB connection and creates indexes
npm run create-admin              # prompts for Name, Email, Password, Role
npm run dev                       # http://localhost:3001  →  /login
```

### Environment variables (`.env.local`, never committed)

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | ✓ | Atlas connection string. **URL-encode the password** (`@`→`%40`, `#`→`%23`, `/`→`%2F`, `:`→`%3A`). The app always uses the `sprinkle_sparkle` database. |
| `AUTH_SECRET` | ✓ | 32+ random characters. Generate with `npx auth secret`. Changing it signs everyone out. |
| `AUTH_TRUST_HOST` | self-hosting | `true` when not deployed on Vercel. |
| `AUTH_URL` | production | Public URL of the admin, e.g. `https://admin.example.com`. |
| `STOREFRONT_ORIGINS` | | Customer-website origins allowed to call `/api/public/*` from a browser. |
| `STORAGE_PROVIDER` | | `local` (files in `./storage/uploads`, served at `/media/*`) or `s3` (S3 / R2 / MinIO; also set `STORAGE_PUBLIC_BASE_URL` and `S3_*`). |
| `UPLOAD_MAX_MB` | | Default 8. Images are converted to WebP and resized to at most 2000px. |

Atlas: add your machine's or server's IP under **Network Access**, and use a database user
that only has access to `sprinkle_sparkle`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js on port 3001 |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:check` | Ping MongoDB, sync indexes, count admins (never prints the URI) |
| `npm run create-admin` | Create an admin interactively. Password input is hidden and must be confirmed. |
| `npm run test:auth` | End-to-end auth tests (`TEST_BASE_URL`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`) |
| `npm run test:api` | **Backend API smoke test** through the real HTTP API with self-cleaning test data (`API_TEST_BASE_URL`, `API_TEST_ADMIN_EMAIL`, `API_TEST_ADMIN_PASSWORD`). See `docs/API-SMOKE-TEST.md`. |
| `npm run test:catalog` | End-to-end catalog + public API tests. Needs a throwaway database with a SUPER_ADMIN and an ADMIN (`TEST_BASE_URL`, `MONGODB_URI`, `TEST_SUPER_*`, `TEST_ADMIN_*`) |
| `npm run test:registration` | End-to-end registration + roles tests. Needs an EMPTY throwaway database (`TEST_BASE_URL`, `MONGODB_URI`) |

For automation, `create-admin` also accepts `--name`, `--email` and `--role`, and reads the password
from the `ADMIN_PASSWORD` environment variable. The password is never passed as a flag.

## Admin accounts

**First SUPER_ADMIN.** While the database has no admins, `/register` accepts exactly one registration (name, email,
password, confirm password). That account always becomes `SUPER_ADMIN`; the form has no role field. After that,
`/register` shows "Admin registration is currently restricted." and the login page stops showing the link. A one-time
lock document (`setup_state`) guarantees that only one registration can succeed, even if several are submitted at once.

> No setup code is required, so whoever registers first becomes SUPER_ADMIN. **Create the first admin before the
> site is publicly reachable**, or use `npm run create-admin` on the server, which closes `/register` too.

**More admins.** A SUPER_ADMIN goes to **Admin Users** (`/admin/users`) and can create (with a confirmation step
before creating another SUPER_ADMIN), edit, activate/deactivate, reset passwords (enter one or generate one) and delete admins.

| | SUPER_ADMIN | ADMIN |
|---|---|---|
| Dashboard, Products, Categories, Subcategories, Collections, Occasions, Brands, Media | ✓ | ✓ |
| Admin Users (`/admin/users`, `/api/admin/users/*`) | ✓ | ✗ (redirect / 403) |
| Settings, Security (`/admin/settings`, `/admin/settings/security`) | ✓ | ✗ (redirect) |

Safety rules: you can't change your own role, deactivate yourself or delete yourself, and there must always be at least one
active SUPER_ADMIN. Deactivation, a role change, a password reset and deletion all sign that admin out immediately.

## How authentication works

```
/login form (RHF + Zod) → loginAction (server action, Zod again) → Auth.js Credentials authorize():
  rate-limit check → find AdminUser by email → bcrypt compare (a dummy hash is used for unknown emails)
  → isActive check → create AdminSession {sid} → JWT cookie (httpOnly) carrying uid/role/sid → redirect /admin
```

- **Every admin request** (`requireAdminPage` for pages, `adminRoute` for `/api/admin/*`) checks MongoDB that
  the session record still exists and the admin is still active. The role comes from the database, never from the token.
- **Logout** deletes the session record and clears the cookie, so a copied cookie stops working immediately.
  Deactivating an admin also cuts off their access on their next request.
- **`src/proxy.ts`** (Next 16's name for middleware) is a fast pre-check that redirects or returns 401 without a valid JWT.
- **Brute force:** 5 failed attempts per email, or 25 per IP, within 15 minutes locks sign-in for that key (stored in MongoDB with a TTL).
- **Passwords:** bcrypt with cost 12, at least 12 characters with mixed case and a number, at most 72 bytes.
  `passwordHash` is `select: false` and is stripped from JSON output.

## Structure

```
scripts/create-admin.ts      first-admin / admin creation CLI
scripts/db-check.ts          connection + index check
scripts/auth-test.ts         end-to-end auth tests
src/lib/db.ts                cached Mongoose connection (safe under hot reload)
src/models/AdminUser.ts      admin accounts
src/models/AdminSession.ts   server-side session records (TTL)
src/models/LoginAttempt.ts   brute-force counters (TTL)
src/lib/auth/                Auth.js config, authorize(), session guards, bcrypt, permissions
src/lib/api/admin-route.ts   wrapper for /api/admin/* (auth, permission, CSRF, safe errors)
src/app/login/               login page + server actions (login/logout)
src/app/admin/               protected admin layout, dashboard, section placeholders
src/proxy.ts                 route pre-check
```

## Catalog

- **Products** (`/admin/products`): search, filters, sorting and pagination run on the server. Desktop shows a table and mobile shows cards. Add/Edit uses one form with **Save as draft** / **Publish product**. Drafts never appear on the website.
- **Money** is stored as integer paise. **Stock**, **stock status** and the "from" price are always calculated by the server.
- **Variants**: pick what the options are (Size, Weight, Colour, Pack Quantity or anything else), then add rows (option, price, stock, plus optional SKU, sale price, weight and photo). Product stock is the total of the available options.
- **Images**: drag & drop, reorder, set the main image. Files go to object storage through `src/lib/uploads/storage.ts` (local or S3/R2; add Cloudinary by implementing `StorageProvider`). MongoDB stores only references.
- **Delete safety**: categories and subcategories that still have products are never deleted, and the admin is told what to move first. Images that are in use can't be deleted. Deleting a product always asks for confirmation.
- **Public API** (`/api/public/*`, read-only, CORS-limited): products (search, filters, sorting, pagination, slug lookup), categories, subcategories, collections, occasions, brands, store info. See `storefront-integration/` for the drop-in client for the customer website.
