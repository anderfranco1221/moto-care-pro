# Commit history — branch: main

<!--
Formato de entrada:

## [C001] <título corto>
- date: <UTC ISO 8601>
- branch: main
- purpose: <propósito de la rama/fase>
- previous: <resumen 1-2 frases del commit anterior>
- contribution: <descripción técnica: qué cambió y en qué archivos>
-->

## [C001] Code review Fase 1 (Auth) — 89/100 APPROVE
- date: 2026-09-03T22:04:43Z
- branch: main
- purpose: Fase 1 — autenticación JWT (ver CLAUDE.md / memoria project_fase1_auth)
- previous: (init) Sin commits previos en GCC; se estrena la memoria versionada con la revisión de auth del commit 73bea1c.
- contribution: Revisión con la skill `code-reviewer` (rúbrica 0-100) del módulo auth
  y su cableado global. Nota por eje: correctness 27/30, seguridad 22/25,
  clean-code 18/20, tests 13/15, arquitectura 9/10 = **89/100 → APPROVE**.
  Fortalezas: JwtAuthGuard global vía APP_GUARD (seguro por defecto, opt-out con
  @Public), ValidationPipe global (whitelist+forbidNonWhitelisted+transform),
  bcrypt (10 rounds), password removido de todas las respuestas, login con
  UnauthorizedException genérica (sin enumeración de usuarios). Resuelve la deuda
  documentada en CLAUDE.md (typo `singIn` y comparación de password en claro).
  Findings abiertos (no bloqueantes): (1) Minor seg — JWT_SECRET no se valida al
  arranque (falta validationSchema en ConfigModule); (2) Minor — duplicación del
  patrón `const {password, ...result}` en 3 sitios (extraer helper stripPassword);
  (3) Nit — import absoluto `src/prisma/...` en users.service vs relativo en el resto.
  Caveat: quality_gate (eslint/tsc/jest) NO ejecutado en este worktree por falta de
  node_modules; los .spec.ts existen y la memoria del proyecto los marca en verde.
  Archivos revisados: src/modules/auth/**, src/modules/users/{users.service.ts,
  dto/create-user.dto.ts}, src/app.module.ts, src/main.ts.
- merge_gate: media 89/100, 0 Blockers → **APTA PARA MERGE A master**. Feedback a memoria: ninguno.

## [C002] Política de gate de merge por fases (media ≥ 80)
- date: 2026-09-03T22:04:43Z
- branch: main
- purpose: Infra de calidad — gate de validación antes de master
- previous: [C001] revisó auth (89/100) y estrenó .GCC/.
- contribution: A pedido del usuario, se formaliza el gate de merge por fases. Cambios:
  `.claude/skills/code-reviewer/SKILL.md` (umbral APPROVE bajado a ≥80 sin Blockers;
  nueva sección "Merge gate para fases terminadas" + "Feedback a memoria"; reporte con
  línea de merge gate y lista de fixes mínimos); `references/rubric.md` (umbrales
  alineados + descripción del gate de fase). `.claude/skills/gcc/SKILL.md` (MERGE ahora
  tiene paso 0 obligatorio: correr code-reviewer, abortar si media < 80 o hay Blockers;
  síntesis y main.md registran la nota del gate). Nueva memoria del agente
  `project_merge_gate.md` (type: project) + índice en MEMORY.md. Regla: fases que
  fallan el gate generan `feedback-<slug>.md` (type: feedback, con Why/How to apply)
  para que el trabajo futuro corrija las fallas graves y no las repita.

## [C003] Merge gate Fase 2 (Multitenancy) — 61/100 REQUEST_CHANGES — NO APTA
- date: 2026-09-03T22:30:00Z
- branch: main
- purpose: Gate de merge de Fase 2 (schema-per-tenant) a master
- previous: [C002] formalizó el gate de merge por fases (umbral 80).
- contribution: Aplicado `code-reviewer` sobre `git diff master...claude/tareas-fase-2-qa-validation-c1ad86`
  (tasks 1-5, ~1408 ins / 132 del en fuente). Quality gate REAL ejecutado en el worktree
  de esa rama: eslint PASS (1 warning preexistente en main.ts), tsc PASS, jest unit
  14 suites / 50 tests PASS, cobertura ~65% líneas. Suite e2e de aislamiento no re-corrida
  aquí (necesita Postgres live); PASSED en el QA por rama según memoria del proyecto.
  Nota por eje: correctness 10/30, seguridad 13/25, clean-code 16/20, tests 13/15,
  arquitectura 9/10 = **61/100 → REQUEST_CHANGES**.
  merge_gate: media 61/100 (umbral 80), 0 Blockers duros pero 3 Major → **NO APTA PARA MERGE**.
  3 Major: (1) `provisionTenantSchema` usa `execFileSync` en el handler `@Public()` de
  register → congela el event loop ~2s/registro, vector de DoS anónimo; (2)
  `PrismaClientManager.getClient` no evicta la promise cacheada si `connect()` rechaza →
  un fallo transitorio de PG deja el tenant roto hasta reiniciar; (3) provisioning
  post-commit sin estado ni recuperación → usuario en callejón sin salida si falla.
  Minor: `TENANT_DATABASE_URL` sin validationSchema (recurrente con JWT_SECRET de Fase 1);
  `JwtStrategy.validate` confía el claim del token en vez del User recargado; interface
  TenantPrismaService miente sobre `$transaction`; CLAUDE.md desactualizado.
  Feedback a memoria: feedback_validate_env_at_startup.md, feedback_no_blocking_io_in_request_path.md,
  feedback_multistep_side_effects_need_recovery.md (+ índice en MEMORY.md, sección de gate
  en project_fase2_multitenancy.md).
  Acción: NO se mergeó a master. Fase 2 sigue en su rama de integración. Prerequisito de
  merge: tarea de hardening (3 Major + validationSchema + .env.example) y re-review ≥ 80.
