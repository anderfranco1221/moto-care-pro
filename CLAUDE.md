# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Moto Care Pro is a NestJS 11 backend for motorcycle-workshop maintenance tracking (bikes, services, appointments, supplies/inventory). It is an exploration project: the stated goal (see `README.md`) is a **multitenant architecture using separate database schemas** on PostgreSQL. Fases 0–4 of the Notion plan are done (auth, multitenancy, the domain modules, CI + rate limiting + logging + a coverage gate); Fase 5 (Angular frontend) is not started.

Multitenancy (schema-per-tenant) is implemented (Fase 2): the shared Prisma project (`Tenant`/`User`) lives in `public`, and each tenant's `Motorcycle`/`Service`/`Appointment`/`Supply`/`StockMovement` data lives in its own `tenant_<slug>_<hex>` schema. A request's tenant comes from the JWT, is put on an AsyncLocalStorage context in `JwtStrategy.validate`, and `TenantPrismaService` (a Proxy over `PrismaClientManager`) resolves the right per-schema client on every model call. `Tenant.provisioningStatus` (`PENDING`/`READY`/`FAILED`) tracks whether a tenant's schema is usable; `AuthService.signIn` re-drives provisioning and refuses a token until it is `READY`.

## Commands

```bash
npm run start:dev        # watch-mode dev server (default port 3000, override with PORT)
npm run build            # nest build -> dist/
npm run start:prod       # node dist/main
npm run lint             # eslint --fix over src/apps/libs/test
npm run format           # prettier write over src and test
npm test                 # jest unit tests (*.spec.ts under src/)
npm run test:watch
npm run test:cov
npm run test:e2e         # jest with test/jest-e2e.json
npx jest src/modules/auth/auth.service.spec.ts   # run a single test file
npx jest -t "test name"                          # run tests matching a name
```

Prisma (v7):

```bash
# Shared project (default config = prisma.config.ts)
npx prisma migrate dev --name <name>
npx prisma generate
# Tenant project — generate the client with --config; for a new migration
# use `migrate diff` (see "Generating a tenant migration" below), not
# `migrate dev`, then:
npx prisma generate --config prisma.tenant.config.ts
npm run migrate:tenants                 # replay tenant migrations across every existing tenant schema
```

`postinstall` regenerates both clients; if `@prisma-tenant/client` goes missing after an `npm install`, run `npm run postinstall`.

## Architecture

Standard NestJS module layout. `src/main.ts` bootstraps `AppModule` (`src/app.module.ts`), which wires together `PrismaModule` plus feature modules under `src/modules/`: `auth`, `users`, `motorcycles`, `services`, `appointments`, `supplies`, `health`.

Feature modules follow the Nest CLI convention: `*.module.ts` / `*.controller.ts` / `*.service.ts` with `dto/` for request shapes. Services depend on `PrismaService` (shared) or `TenantPrismaService` (tenant-scoped) for all data access — there is no repository layer. Cross-cutting bits live in `src/common/`: `PrismaExceptionFilter` (global `APP_FILTER`), `orNotFound()` (used by every domain `findOne`), `logger.config.ts` (pino).

### Prisma is the data layer, and its setup is non-standard

- **Prisma 7** with the `@prisma/adapter-pg` driver adapter. `PrismaService` (`src/prisma/prisma.service.ts`) extends `PrismaClient`, is constructed with `new PrismaPg({ connectionString: process.env.DATABASE_URL })`, and connects in `onModuleInit`. Any change to how the shared DB connection is made goes here. Per-tenant connections are built in `PrismaClientManager` (`src/tenancy/`), one cached client per schema.
- **`PrismaModule` and `TenancyModule` are `@Global()`** (deliberate deviation from this repo's explicit-import convention — same justification as `ConfigModule`): `PrismaService`, `TenantPrismaService`, `TenantContextService` and `PrismaClientManager` are injectable anywhere without an explicit import. `TenantsModule` still needs importing for `TenantsService`/`TenantProvisioningService`.
- **Two Prisma projects.** The connection URLs live in `prisma.config.ts` (shared, `DATABASE_URL`) and `prisma.tenant.config.ts` (tenant, `TENANT_DATABASE_URL`), not in the schema files — Prisma 7 moved `datasource.url` out of the schema. Shared schema: `prisma/shared/` (`schema.prisma` = generator + datasource, `auth.prisma` = `Tenant` + `User`), client → `@prisma/client`, migrates against `public`. Tenant schema: `prisma/tenant/` (`bikes.prisma` = `Motorcycle`/`Service`/`Appointment`, `inventory.prisma` = `Supply`/`StockMovement`/`MovementType`), client → `@prisma-tenant/client` (generated under `node_modules/`, not `prisma/generated/`), migrations replayed against each tenant schema via `scripts/migrate-tenants.ts` / `provisionTenantSchema`. Add a model as a new `.prisma` file in the right project's directory.

  **Generating a tenant migration:** `prisma migrate dev` wants to reset the dev DB, which is shared across worktrees — don't. Instead diff against a copy of the current schema without the new model: `npx prisma migrate diff --from-schema <old-copy-dir> --to-schema prisma/tenant --script --config prisma.tenant.config.ts` into a new `prisma/tenant/migrations/<ts>_<name>/migration.sql`, then `migrate deploy`. **Never run `prisma migrate deploy --config prisma.tenant.config.ts` without a `?schema=` in the URL** — it applies the tenant tables to `public` and breaks tenant isolation.

### Domain model

`User` 1—* `Motorcycle` (via `ownerId`); `Motorcycle` 1—* `Service` and 1—* `Appointment`; `User` 1—* `Appointment`; `Supply` 1—* `StockMovement`; `Service` 1—* `StockMovement` (supplies a service consumed). All ids are UUID strings. `Service.create` can take `supplies: [{ supplyId, quantity }]` and deducts stock in one `$transaction` (forwarded by `TenantPrismaService`); `POST /supplies/:id/movements` is the other way stock moves.

## Traceability

Project work plan and tracking are kept in Notion, not in this repo:

- [Plan de trabajo](https://app.notion.com/p/moto-care-pro-Plan-de-trabajo-399bb268ed0c81dfa040f41c7f614a5a)
- [Tablero de seguimiento](https://app.notion.com/p/735370911af544879e5bb8ef32859e24?v=f930a77250644b168a5253f624788b46)

## Skills

Use the `docker-expert` skill for anything touching Dockerfiles, `docker-compose.yml`, image builds, or registry pushes in this project. Use the `clean-code` skill when writing, refactoring, or reviewing any code here (NestJS services, controllers, DTOs, etc.), even if not explicitly requested.

## Conventions & gotchas

- Shared-project services import Prisma types/enums from `@prisma/client` and inject `PrismaService`; tenant-scoped services import from `@prisma-tenant/client` and inject `TenantPrismaService`.
- A global `ValidationPipe` is active (`whitelist` + `forbidNonWhitelisted` + `transform`, see `src/main.ts`), and DTOs use `class-validator` decorators. Domain services still carry `dto as Prisma.*Input` casts — validation is at the DTO layer, not the Prisma call.
- Errors: `PrismaExceptionFilter` (global) maps `@prisma-tenant/client` errors to HTTP — P2025 → 404, P2002 → 409, P2003 → 422. Shared-client errors are not covered by it. Domain `findOne` uses `orNotFound()` for a 404 on a miss. Domain `:id` params go through `ParseUUIDPipe` (400 on a malformed id).
- Required env vars are validated at boot (`src/config/env.validation.ts`, wired via `ConfigModule.forRoot({ validate })`): `DATABASE_URL`, `TENANT_DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`; `LOG_LEVEL` is optional. See `.env.example`. A missing one fails startup, not the first request.
- `AuthService.signIn` authenticates with `bcrypt.compare` and issues a JWT. Global `APP_GUARD`s: `ThrottlerGuard` (100 req/min/IP; `/auth/login` and `/auth/register` are `@Throttle`d to 5/min) then `JwtAuthGuard` (opt routes out with `@Public()`; `@CurrentUser()` reads the validated user). The method is `signIn` — an older typo `singIn` may still be in docs.
- Logging is `nestjs-pino` (`src/common/logger.config.ts`): JSON in production, pretty in dev, `authorization`/`cookie`/`password` redacted. `main.ts` routes Nest's logger through it and disables `x-powered-by`.
- ESLint config is flat (`eslint.config.mjs`); `@typescript-eslint/no-floating-promises` and `no-unsafe-argument` are downgraded to warnings.
- Jest on this machine hangs when run in parallel — use `--runInBand` for both unit and e2e. `npm run test:e2e` needs a running Postgres (`docker compose up -d db`); `test/setup-e2e.ts` sets `THROTTLE_DISABLED`/`LOG_LEVEL=silent` for the run (except `throttle.e2e-spec.ts`). `package.json` has a `coverageThreshold` enforced in CI (`main.ts` and `*.module.ts` excluded).
