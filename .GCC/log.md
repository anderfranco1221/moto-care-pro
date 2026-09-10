# OTA log — branch: main

<!--
Formato de entrada (máx 50, FIFO):

### [L001] <UTC ISO 8601> (main)
- O: <observation>
- T: <thought>
- A: <action>
-->

### [L001] 2026-09-03T22:04:43Z (main)
- O: se inicializó .GCC/ y se creó la skill code-reviewer con rúbrica 0-100
- T: para estrenar el loop, revisar el código de auth (commit 73bea1c) y dejar el hito
- A: review aplicado → 89/100 APPROVE; registrado en commit.md como [C001]

### [L002] 2026-09-03T22:04:43Z (main)
- O: el worktree gcc-agent-setup no tiene node_modules; quality_gate no puede correr
- T: no fabricar resultados; marcar el gate como no ejecutado (SKIP) y calificar por revisión manual
- A: caveat anotado en [C001]; recomendación: correr `npm ci` y re-verificar el gate en el checkout principal

### [L003] 2026-09-03T22:04:43Z (main)
- O: el usuario fija el gate de merge de fases en media ≥ 80/100 y pide feedback a memoria cuando falla
- T: codificar el gate en code-reviewer (umbrales + secciones) y en el paso 0 de MERGE de /gcc; persistir la política en memoria
- A: editadas ambas skills; creada project_merge_gate.md; registrado como [C002]

### [L004] 2026-09-03T22:30:00Z (main)
- O: el usuario pide fusionar a master las fases ya revisadas; Fase 1 (89/100) ya está en master, Fase 2 nunca pasó el gate nuevo
- T: correr el gate sobre la rama de Fase 2 antes de tocar master; el quality gate SÍ corre en el worktree de esa rama (node_modules presente)
- A: code-reviewer sobre Fase 2 = 61/100 REQUEST_CHANGES; 3 Major (execFileSync bloqueante, promise rechazada cacheada, provisioning sin recovery)

### [L005] 2026-09-03T22:30:00Z (main)
- O: 61 < 80 y hay 3 Major → NO APTA para merge
- T: no tocar master; escribir feedback a memoria de los patrones graves para que el hardening los corrija
- A: 3 feedback_*.md creados; project_fase2 y MEMORY.md actualizados; [C003] registrado; master intacto

### [L006] 2026-09-04T01:30:00Z (main)
- O: peer session avisa que la rama de hardening claude/code-review-adjustments-fa2053 (4c89346) está lista
- T: re-review independiente — leer el código de los 3 fixes y correr el gate completo, no confiar en el resumen
- A: gate verde (unit 16/61, e2e 2/8 con PG real, tsc/eslint PASS); 3 Major resueltos; 89/100 APPROVE → APTA; [C004] registrado

### [L007] 2026-09-04T01:30:00Z (main)
- O: master está checked out en el checkout principal; esta sesión corre en un worktree y tiene bloqueado operar ahí
- T: no puedo ejecutar el merge yo; registrar APTA y entregar el comando exacto al usuario
- A: [C004] marcado APTA, merge pendiente de ejecución manual en el checkout principal; sin push

### [L008] 2026-09-10T23:15:00Z (main)
- O: usuario pide continuar fases 3/4/5 con gate code-review antes de cada PR; PRs #1 (Fase 2) y #2 (CI+tooling) ya en master
- T: landear el trabajo pendiente de claude/integration por tarea; empezar por F3.1 services que ya estaba implementado y verde
- A: rebased fase-3.1-services sobre master limpio; gate 92/100 APPROVE; [C005]; PR #3. Pollución de public con tablas tenant (por `migrate deploy` sin ?schema= contra la DB compartida) detectada y limpiada — el e2e de aislamiento volvió a verde

### [L009] 2026-09-10T23:25:00Z (main)
- O: F3.2 appointments — no existía módulo; construir CRUD espejando el patrón de services (el más limpio: ParseUUIDPipe + tests por método)
- T: mantener consistencia con services/motorcycles; DTO con userId/motorcycleId UUID + scheduledAt ISO; e2e con aislamiento cross-tenant
- A: módulo + unit (10) + e2e (6, incl. bad date); gate 91/100 APPROVE; [C006]; PR #4 apilada sobre #3

### [L010] 2026-09-10T23:40:00Z (main)
- O: F3.3 insumos/inventario — modelos nuevos en prisma/tenant + endpoint de movimiento de stock; TenantPrismaService (Proxy) no soporta $transaction
- T: atomicidad del movimiento vía nested write de Prisma (supply.update con movements.create), no $transaction; guard de stock negativo con where condicional; migración por migrate diff (DB compartida, migrate dev pide reset)
- A: módulo supplies (7 endpoints) + unit 12 + e2e 7; interfaz TenantPrismaService ampliada; gate 93/100 APPROVE; [C007]; PR #5 apilada sobre #4

### [L011] 2026-09-10T23:55:00Z (main)
- O: F3.4 cierra Fase 3 — "relaciones y validaciones entre motos, servicios, citas e insumos"; el Proxy de TenantPrismaService no soportaba $transaction
- T: filtro global de excepciones Prisma (404/409/422) + orNotFound en findOne + validación de FK (motorcycleId) + userId desde JWT + Service que consume stock en $transaction (rollback atómico)
- A: PrismaExceptionFilter (APP_FILTER), CurrentUser decorator, $transaction reenviado por el Proxy, migración link_service_stock_movements; gate 91/100 APPROVE; [C008]; PR #6; Fase 3 completa

### [L012] 2026-09-10T00:15:00Z (main)
- O: F4.3 — rate limiting + logging estructurado + revisar healthcheck; el register @Public() era vector de DoS ([C003])
- T: @nestjs/throttler (5/min en auth), nestjs-pino (JSON prod / pretty dev, redacción de secretos), verificar que la imagen podada (sin pino-pretty, NODE_ENV=production) arranca
- A: throttler + pino + x-powered-by off; skipIf(THROTTLE_DISABLED) para e2e + throttle.e2e-spec dedicado; imagen docker verificada (JSON logs, 429, /health 200); healthcheck actual ya es adecuado; gate 93/100; [C009]; PR #7

### [L013] 2026-09-10T00:35:00Z (main)
- O: F4.4 — "unit tests de todos los services de dominio + e2e por tenant"; motorcycles solo tenía stubs, health 0%
- T: specs reales de motorcycles + health, motorcycles.e2e nuevo, ParseUUIDPipe en motorcycles para consistencia, coverageThreshold enforced en CI
- A: unit 25/118, e2e 7/36, cobertura 94% stmts; threshold 88/80/85/88; gate 90/100; [C010]; PR #8; Fase 4 cerrada
