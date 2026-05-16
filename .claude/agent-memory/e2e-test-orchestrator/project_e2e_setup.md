---
name: pos-admin API E2E setup
description: E2E testing configuration, auth flow, test credentials, and file locations for the pos-admin NestJS API
type: project
---

Framework: Playwright-free setup — uses NestJS `Test.createTestingModule` + `supertest` (in-process, no real server needed).

Config file: `api/test/jest-e2e.json` — `rootDir: "."` resolves to the `test/` directory. `testRegex: ".e2e-spec.ts$"`. Added `"testTimeout": 60000` to handle slow NestJS bootstrap.

Run command: `pnpm exec jest --config ./test/jest-e2e.json --testPathPatterns="customers"` from `api/`. Note: `pnpm run test:e2e -- --testPathPattern=...` fails silently because Jest 30+ replaced `--testPathPattern` (singular) with `--testPathPatterns` (plural).

Two-step auth flow for tests:
1. POST /api/auth/login → { accessToken: tempToken, availableTenants }  (HTTP 201)
2. PATCH /api/auth/select-tenant/:slug with Bearer tempToken → { accessToken: finalToken }  (HTTP 200)

Test credentials (from prisma/seed.ts):
- email: admin@ecommerce.com | password: admin123 | tenantSlug: default

App setup in E2E beforeAll: must call `app.setGlobalPrefix('api')` and `app.useGlobalPipes(new ValidationPipe({ transform, whitelist, forbidNonWhitelisted }))` to mirror main.ts.

**Why:** The test module does not run main.ts bootstrap — all middleware/pipes must be re-applied manually.
**How to apply:** Always replicate main.ts pipeline configuration in E2E test beforeAll.

Completed E2E specs: customers (api/test/customers.e2e-spec.ts), suppliers (api/test/suppliers.e2e-spec.ts).
Both use `Date.now()` unique suffixes on test emails and clean up created records in afterAll.
