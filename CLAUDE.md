# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Moto Care Pro is a NestJS 11 backend for motorcycle-workshop maintenance tracking (bikes, services, appointments). It is an exploration project: the stated goal (see `README.md`) is a **multitenant architecture using separate database schemas** on PostgreSQL.

Multitenancy (schema-per-tenant) is now implemented (Fase 2): the shared Prisma project (`Tenant`/`User`) lives in `public`, and each tenant's `Motorcycle`/`Service`/`Appointment` data lives in its own `tenant_<slug>_<hex>` schema. A request's tenant comes from the JWT, is put on an AsyncLocalStorage context in `JwtStrategy.validate`, and `TenantPrismaService` (a Proxy over `PrismaClientManager`) resolves the right per-schema client on every model call. `Tenant.provisioningStatus` (`PENDING`/`READY`/`FAILED`) tracks whether a tenant's schema is usable; `AuthService.signIn` re-drives provisioning and refuses a token until it is `READY`.

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
# Tenant project — always pass --config
npx prisma migrate dev --name <name> --config prisma.tenant.config.ts
npx prisma generate --config prisma.tenant.config.ts
npm run migrate:tenants                 # replay tenant migrations across every existing tenant schema
```

`postinstall` regenerates both clients; if `@prisma-tenant/client` goes missing after an `npm install`, run `npm run postinstall`.

## Architecture

Standard NestJS module layout. `src/main.ts` bootstraps `AppModule` (`src/app.module.ts`), which wires together `PrismaModule` plus feature modules under `src/modules/` (`auth`, `users`, `motorcycles`).

Feature modules follow the Nest CLI convention: `*.module.ts` / `*.controller.ts` / `*.service.ts` with `dto/` for request shapes. Services depend on `PrismaService` for all data access — there is no repository layer.

### Prisma is the data layer, and its setup is non-standard

- **Prisma 7** with the `@prisma/adapter-pg` driver adapter. `PrismaService` (`src/prisma/prisma.service.ts`) extends `PrismaClient`, is constructed with `new PrismaPg({ connectionString: process.env.DATABASE_URL })`, and connects in `onModuleInit`. Any change to how the shared DB connection is made goes here. Per-tenant connections are built in `PrismaClientManager` (`src/tenancy/`), one cached client per schema.
- **`PrismaModule` and `TenancyModule` are `@Global()`** (deliberate deviation from this repo's explicit-import convention — same justification as `ConfigModule`): `PrismaService`, `TenantPrismaService`, `TenantContextService` and `PrismaClientManager` are injectable anywhere without an explicit import. `TenantsModule` still needs importing for `TenantsService`/`TenantProvisioningService`.
- **Two Prisma projects.** The connection URLs live in `prisma.config.ts` (shared, `DATABASE_URL`) and `prisma.tenant.config.ts` (tenant, `TENANT_DATABASE_URL`), not in the schema files — Prisma 7 moved `datasource.url` out of the schema. Shared schema: `prisma/shared/` (`schema.prisma` = generator + datasource, `auth.prisma` = `Tenant` + `User`), client → `@prisma/client`, migrates against `public`. Tenant schema: `prisma/tenant/` (`bikes.prisma` = `Motorcycle`/`Service`/`Appointment`), client → `@prisma-tenant/client` (generated under `node_modules/`, not `prisma/generated/`), migrations replayed against each tenant schema via `scripts/migrate-tenants.ts` / `provisionTenantSchema`. Add a model as a new `.prisma` file in the right project's directory.

### Domain model

`User` 1—* `Motorcycle` (via `ownerId`); `Motorcycle` 1—* `Service` and 1—* `Appointment`; `User` 1—* `Appointment`. All ids are UUID strings.

## Traceability

Project work plan and tracking are kept in Notion, not in this repo:

- [Plan de trabajo](https://app.notion.com/p/moto-care-pro-Plan-de-trabajo-399bb268ed0c81dfa040f41c7f614a5a)
- [Tablero de seguimiento](https://app.notion.com/p/735370911af544879e5bb8ef32859e24?v=f930a77250644b168a5253f624788b46)

## Skills

Use the `docker-expert` skill for anything touching Dockerfiles, `docker-compose.yml`, image builds, or registry pushes in this project. Use the `clean-code` skill when writing, refactoring, or reviewing any code here (NestJS services, controllers, DTOs, etc.), even if not explicitly requested.

## Conventions & gotchas

- Shared-project services import Prisma types/enums from `@prisma/client` and inject `PrismaService`; tenant-scoped services import from `@prisma-tenant/client` and inject `TenantPrismaService`.
- A global `ValidationPipe` is active (`whitelist` + `forbidNonWhitelisted` + `transform`, see `src/main.ts`), and DTOs use `class-validator` decorators (see `create-user.dto.ts`). Some older `dto as Prisma.*Input` casts remain in `motorcycles.service.ts`.
- Required env vars are validated at boot (`src/config/env.validation.ts`, wired via `ConfigModule.forRoot({ validate })`): `DATABASE_URL`, `TENANT_DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`. See `.env.example`. A missing one fails startup, not the first request.
- `AuthService.signIn` authenticates with `bcrypt.compare` and issues a JWT (`JwtAuthGuard` is a global `APP_GUARD`; opt routes out with `@Public()`). Note the method is `signIn`, but an older typo `singIn` may still be referenced in docs.
- ESLint config is flat (`eslint.config.mjs`); `@typescript-eslint/no-floating-promises` and `no-unsafe-argument` are downgraded to warnings.
- Jest on this machine hangs when run in parallel — use `--runInBand` for both unit and e2e. `npm run test:e2e` needs a running Postgres (`docker compose up -d db`).
