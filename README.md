# Moto Care Pro

Backend NestJS 11 para que un taller de motos lleve la trazabilidad de sus
mantenimientos: motos, servicios realizados, citas e insumos (con movimientos
de stock).

Es un **proyecto de exploración**. El objetivo es probar NestJS + una
**arquitectura multitenant con un schema de PostgreSQL por tenant**, usando
Prisma 7 con el driver adapter `@prisma/adapter-pg`.

## Multitenancy (schema-per-tenant)

- Los datos compartidos (`Tenant`, `User`) viven en el schema `public`.
- Los datos de cada taller (`Motorcycle`, `Service`, `Appointment`, `Supply`,
  `StockMovement`) viven en su propio schema `tenant_<slug>_<hex>`.
- El tenant de cada request sale de un claim del JWT. `JwtStrategy.validate`
  lo deja en un contexto `AsyncLocalStorage` (`nestjs-cls`), y
  `TenantPrismaService` —un `Proxy` sobre `PrismaClientManager`— resuelve el
  cliente Prisma del schema correcto en cada llamada a un modelo.
- Al registrarse un taller, `AuthService.register` crea su schema y le corre
  las migraciones del proyecto tenant (`provisionTenantSchema`).
  `Tenant.provisioningStatus` (`PENDING`/`READY`/`FAILED`) indica si el schema
  quedó usable; `signIn` reintenta el provisioning y no entrega token hasta
  que esté `READY`.

## Stack

NestJS 11 · Prisma 7 (`@prisma/adapter-pg`) · PostgreSQL · Passport JWT +
bcrypt · `class-validator` · `@nestjs/throttler` · `nestjs-pino` · Swagger ·
Jest · Docker.

## Puesta en marcha

```bash
cp .env.example .env          # todas las claves son obligatorias salvo LOG_LEVEL
docker compose up -d db       # Postgres en localhost:5433
npm install                   # postinstall genera los dos clientes Prisma
npx prisma migrate deploy     # migra el proyecto compartido contra `public`
npm run start:dev             # http://localhost:3000  (Swagger en /docs)
```

Todo el stack en contenedores (necesita `JWT_SECRET` en el `docker-compose.yml`,
ya incluido): `docker compose up --build`.

## Comandos

```bash
npm run start:dev        # servidor en watch mode
npm run build            # nest build -> dist/
npm run lint             # eslint --fix
npm test                 # unit tests (--runInBand en esta máquina)
npm run test:cov         # unit + cobertura (umbral en package.json)
npm run test:e2e         # e2e (necesita Postgres arriba)
npm run migrate:tenants  # replay de migraciones tenant en cada schema existente
```

> Jest se cuelga corriendo en paralelo en algunas máquinas — usar `--runInBand`.

## Arquitectura

Layout estándar de NestJS. `src/main.ts` levanta `AppModule`, que arma
`PrismaModule` + los módulos de feature en `src/modules/`:

| Módulo | Rutas | Notas |
|---|---|---|
| `auth` | `POST /auth/register`, `POST /auth/login` | bcrypt + JWT; rate-limit 5/min |
| `motorcycles` | CRUD `/motorcycles` | |
| `services` | CRUD `/services` | un servicio puede consumir insumos y descontar stock en un `$transaction` |
| `appointments` | CRUD `/appointments` | `userId` sale del JWT, no del body |
| `supplies` | CRUD `/supplies` + `/supplies/:id/movements` | `stock` solo se mueve por movimientos; OUT sin stock → 409 |
| `health` | `GET /health` | `@Public()`, prueba la DB con `SELECT 1` |
| `users` | — | usado por `auth` |

Los servicios no tienen capa de repositorio: dependen de `PrismaService`
(datos compartidos) o `TenantPrismaService` (datos del tenant). Un
`PrismaExceptionFilter` global mapea los errores de Prisma a HTTP
(P2025 → 404, P2002 → 409, P2003 → 422).

### Modelo de dominio

`User` 1—* `Motorcycle` (por `ownerId`); `Motorcycle` 1—* `Service` y 1—*
`Appointment`; `User` 1—* `Appointment`; `Supply` 1—* `StockMovement`;
`Service` 1—* `StockMovement` (los insumos consumidos). Todos los ids son UUID.

### Los dos proyectos Prisma

- **Compartido** — `prisma/shared/`, config `prisma.config.ts` (`DATABASE_URL`),
  cliente `@prisma/client`, migra contra `public`.
- **Tenant** — `prisma/tenant/`, config `prisma.tenant.config.ts`
  (`TENANT_DATABASE_URL`), cliente `@prisma-tenant/client` (generado bajo
  `node_modules/`), migraciones replayadas en cada schema de tenant.

## Estado

| Fase | Estado |
|---|---|
| 0 — Base (ConfigModule, Docker, ValidationPipe, Swagger) | ✅ |
| 1 — Auth y usuarios (bcrypt + JWT) | ✅ |
| 2 — Multitenancy schema-per-tenant | ✅ |
| 3 — Dominio del taller (services, appointments, insumos, relaciones) | ✅ |
| 4 — Calidad (CI, rate limiting, logging, cobertura) | ✅ |
| 5 — Frontend (Angular) | ⬜ pendiente |

## Trazabilidad

El plan de trabajo y el tablero de seguimiento están en Notion (no en el repo):

- [Plan de trabajo](https://app.notion.com/p/moto-care-pro-Plan-de-trabajo-399bb268ed0c81dfa040f41c7f614a5a)
- [Tablero de seguimiento](https://app.notion.com/p/735370911af544879e5bb8ef32859e24?v=f930a77250644b168a5253f624788b46)

MER inicial: <https://drawdb.vercel.app/editor?shareId=fd324f88c1f244d657207c19ec0ba4f8>
