# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Moto Care Pro is a NestJS 11 backend for motorcycle-workshop maintenance tracking (bikes, services, appointments). It is an exploration project: the stated goal (see `README.md`) is to try a **multitenant architecture using separate database schemas** on PostgreSQL. That multitenancy is not yet implemented — the current code uses a single shared Prisma datasource. Keep this intent in mind when extending data access.

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
npx prisma migrate dev --name <name>   # create + apply a migration
npx prisma generate                    # regenerate the client after schema edits
npx prisma studio
```

## Architecture

Standard NestJS module layout. `src/main.ts` bootstraps `AppModule` (`src/app.module.ts`), which wires together `PrismaModule` plus feature modules under `src/modules/` (`auth`, `users`, `motorcycles`).

Feature modules follow the Nest CLI convention: `*.module.ts` / `*.controller.ts` / `*.service.ts` with `dto/` for request shapes. Services depend on `PrismaService` for all data access — there is no repository layer.

### Prisma is the data layer, and its setup is non-standard

- **Prisma 7** with the `@prisma/adapter-pg` driver adapter. `PrismaService` (`src/prisma/prisma.service.ts`) extends `PrismaClient`, is constructed with `new PrismaPg({ connectionString: process.env.DATABASE_URL })`, and connects in `onModuleInit`. Any change to how the DB connection is made goes here.
- **`PrismaModule` is not global.** A module that needs DB access must import `PrismaModule` (it exports `PrismaService`), or the service must be provided otherwise. When adding a feature module, remember this import.
- **The connection URL lives in `prisma.config.ts`, not in `schema.prisma`.** Prisma 7 moved the `datasource.url` out of the schema; the schema's `datasource db` block intentionally has no `url`. Update `prisma.config.ts` for datasource/migrations config.
- **The schema is split across multiple files** in `prisma/schema/` (`schema.prisma` = generator + datasource, `auth.prisma` = `User`, `bikes.prisma` = `Motorcycle` / `Service` / `Appointment`). `prisma.config.ts` points `schema` at the whole `prisma/schema` directory, so add new models as new `.prisma` files there rather than growing one file.
- `prisma/generated/prisma/` is generated client output — do not edit by hand.

### Domain model

`User` 1—* `Motorcycle` (via `ownerId`); `Motorcycle` 1—* `Service` and 1—* `Appointment`; `User` 1—* `Appointment`. All ids are UUID strings.

## Traceability

Project work plan and tracking are kept in Notion, not in this repo:

- [Plan de trabajo](https://app.notion.com/p/moto-care-pro-Plan-de-trabajo-399bb268ed0c81dfa040f41c7f614a5a)
- [Tablero de seguimiento](https://app.notion.com/p/735370911af544879e5bb8ef32859e24?v=f930a77250644b168a5253f624788b46)

## Skills

Use the `docker-expert` skill for anything touching Dockerfiles, `docker-compose.yml`, image builds, or registry pushes in this project. Use the `clean-code` skill when writing, refactoring, or reviewing any code here (NestJS services, controllers, DTOs, etc.), even if not explicitly requested.

## Conventions & gotchas

- Services import Prisma types/enums from `@prisma/client` and inject `PrismaService` via `src/prisma/prisma.service`.
- DTOs are currently cast to Prisma input types (e.g. `dto as Prisma.MotorcycleCreateInput`); there is no runtime validation (`class-validator`/`ValidationPipe` are not yet set up).
- `AuthService.singIn` (note the spelling) does a plaintext password comparison against `UsersService.findOne`. Passwords are stored and compared in the clear — no hashing or JWT yet. Treat auth as a stub.
- ESLint config is flat (`eslint.config.mjs`); `@typescript-eslint/no-floating-promises` and `no-unsafe-argument` are downgraded to warnings.
