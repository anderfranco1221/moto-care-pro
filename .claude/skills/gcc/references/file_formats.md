# GCC — Formato de archivos

Referencia de la estructura y el formato de cada archivo bajo `.GCC/`. La skill
`/gcc` lee y escribe estos archivos; mantén el formato para que la recuperación de
contexto entre sesiones sea fiable.

## `main.md` (solo rama main)

Roadmap global. Secciones fijas:

- `## Objetivos` — objetivos del proyecto (estables).
- `## Milestones` — un `###` por hito, en orden cronológico. Cada COMMIT en `main`
  agrega o actualiza un hito. Cada MERGE agrega un hito con el resultado de la rama.
- `## Active Branches` — lista de ramas vivas. BRANCH agrega; MERGE retira.

Ejemplo de hito:

```
### M02 — Auth (Fase 1) · 2026-09-03
JWT + bcrypt implementado y verificado. code-review: 82/100 (APPROVE).
Commits: [C002]..[C004]. Ramas: (ninguna).
```

## `metadata.yaml`

Estado de infraestructura. Campos:

- `version` — versión del formato GCC.
- `created` — timestamp UTC ISO 8601 de init.
- `config.proactive_commits` — `true`/`false`.
- `current_branch` — rama activa donde caen COMMIT/log.
- `branches.<nombre>` — `status` (`active` | `merged` | `abandoned`), `created`,
  `parent` (rama padre o `null` para main).
- `file_tree` — lista de rutas que GCC rastrea; se actualiza en cada COMMIT que crea
  o modifica archivos.

## `commit.md` (uno por rama)

Historial de commits. IDs secuenciales `[C001]`, `[C002]`, ... por rama. Cada entrada:

```
## [C003] Fix testing infra
- date: 2026-09-03T14:20:00Z
- branch: main
- purpose: Fase 1 — autenticación
- previous: Se implementó login/registro con JWT.
- contribution: moduleNameMapper en jest.config, downgrade de reglas eslint,
  archivos: package.json, jest config, src/modules/auth/*.spec.ts
```

## `log.md` (uno por rama)

Log de ejecución OTA. IDs secuenciales `[L001]`, `[L002]`, ... Máximo **50 entradas**
por archivo; al exceder, elimina las más antiguas (FIFO). Cada entrada:

```
### [L007] 2026-09-03T14:25:00Z (main)
- O: los tests de auth fallaban por alias de import sin resolver
- T: falta moduleNameMapper para @/ en jest
- A: agregado mapper y re-ejecutados los tests (verde)
```

## `branches/<nombre>/summary.md`

Se crea con BRANCH. Contiene:

```
# Branch: <nombre>
- purpose: <qué se explora>
- parent: <rama padre>
- created: <UTC ISO 8601>
- status: active

## Hipótesis
- <hipótesis 1>
- <hipótesis 2>

## Resultado
<!-- Se completa antes del MERGE: qué se aprendió / decisión. -->
```

`branches/<nombre>/commit.md` y `branches/<nombre>/log.md` usan el mismo formato que
los de main, pero con `branch: <nombre>`.
