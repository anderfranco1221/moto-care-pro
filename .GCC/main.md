# Moto Care Pro — Roadmap (GCC main)

> Memoria versionada del proyecto. Editada por la skill `/gcc`.
> Creado: 2026-09-03T22:03:30Z

## Objetivos

- Backend NestJS 11 para taller de motos (bikes, services, appointments).
- Objetivo de exploración: multitenancy por schemas de PostgreSQL (ver README).

## Milestones

<!-- Cada COMMIT en main agrega o actualiza un hito aquí. -->

### M01 — Fase 1 Auth revisada · 2026-09-03
JWT + bcrypt implementado y revisado con `code-reviewer`: **89/100 → APPROVE ·
APTA PARA MERGE** (correctness 27, seguridad 22, clean 18, tests 13, arquitectura 9).
Resuelve la deuda de auth documentada en CLAUDE.md. Commit GCC: [C001]. Commit git:
73bea1c. 3 findings menores abiertos (validación de JWT_SECRET, helper stripPassword,
import).

### M02 — Gate de merge por fases · 2026-09-03
Política formalizada: ninguna fase entra a `master` con media < 80/100 o con Blockers.
El MERGE de `/gcc` corre `code-reviewer` como paso 0. Fases que fallan → `feedback-*`
en la memoria del agente. Commit GCC: [C002].

### M03 — Fase 2 (Multitenancy): gate NO superado · 2026-09-03
`code-reviewer` sobre `claude/tareas-fase-2-qa-validation-c1ad86`: **61/100 →
REQUEST_CHANGES · NO APTA** (correctness 10, seguridad 13, clean 16, tests 13, arq 9).
Quality gate real: eslint/tsc/unit PASS, cobertura ~65%. 3 Major (execFileSync en
request path, promise rechazada cacheada, provisioning sin recovery). **NO se mergeó a
master.** 3 `feedback-*` en memoria. Prerequisito de merge: tarea de hardening + re-review
≥ 80. Commit GCC: [C003].

### M04 — Fase 2 (Multitenancy): gate SUPERADO tras hardening · 2026-09-04
`code-reviewer` sobre `claude/code-review-adjustments-fa2053` (Fase 2 + hardening 4c89346):
**89/100 → APPROVE · APTA** (correctness 28, seguridad 21, clean 18, tests 13, arq 10).
Quality gate real: eslint/tsc PASS, unit 16/61, e2e 2/8 (tenant isolation contra PG real),
cobertura ~69%. Los 3 Major de M03 resueltos y verificados. Commit GCC: [C004].
**Merge `--no-ff` a master pendiente de ejecución manual** en el checkout principal
(esta sesión está en un worktree). Integra Fase 2 completa. Sin push.

### M05 — Fase 2 en master · 2026-09-10
PR #1 `fase-2-multitenancy` MERGED a master (schema-per-tenant completo + hardening).
PR #2 `chore/gcc-ci-tooling` MERGED: CI GitHub Actions (Fase 4.1) + skills `/gcc` y
`code-reviewer` + `.GCC/`. master = 7ead3db.

### M06 — Fase 3.1 (módulo services) revisada · 2026-09-10
`code-reviewer` sobre `fase-3.1-services` (`git diff master...HEAD`): **92/100 → APPROVE ·
APTA** (correctness 25, seguridad 24, clean 19, tests 14, arq 10). Quality gate real:
eslint PASS (1 warning preexistente), tsc PASS, unit 18/71, e2e 3/13 (incl. aislamiento
cross-tenant de services contra PG real). 0 Blockers. Findings menores → follow-up en
F3.4 (fila inexistente → 500 en PATCH/DELETE; FK motorcycleId no verificada; patrón
compartido con el módulo motorcycles). Commit GCC: [C005]. PR #3.

## Active Branches (recordatorio)
- `fase-3.1-services` — F3.1 services CRUD. Estado: APTA (92/100). PR #3 abierta.

## Active Branches

<!-- BRANCH registra ramas activas aquí; MERGE las retira. -->

_(ninguna)_
