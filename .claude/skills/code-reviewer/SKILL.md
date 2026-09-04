---
name: code-reviewer
description: "Revisión de código con CALIFICACIÓN clara (rúbrica 0-100 por ejes + veredicto APPROVE/REQUEST_CHANGES) para NestJS/TypeScript, Prisma y este proyecto Moto Care Pro. Úsala al revisar un PR, un diff o una rama, dar feedback de código, o poner un gate de calidad antes de mergear. Produce un puntaje comparable entre revisiones para mejorar continuamente. Se integra con la skill /gcc para dejar el hito registrado."
---

# Code Reviewer (con calificación)

Revisa cambios de código y devuelve una **calificación numérica reproducible** más un
**veredicto de merge**. El objetivo no es solo encontrar bugs, sino producir una nota
**comparable entre revisiones** para que el equipo mejore de forma continua: la misma
rúbrica, aplicada igual, hace que "82 hoy vs 71 la semana pasada" signifique algo.

Antes de emitir código o revisarlo en este repo, aplica también la skill `clean-code`
(está declarada como obligatoria en `CLAUDE.md`).

## Qué revisar (target)

Por defecto revisa el diff pendiente. Acepta un target explícito:

- **diff local**: `git diff master...HEAD` o `git diff` (sin argumento).
- **rama**: nombre de rama a comparar contra `master`.
- **PR**: número de PR de GitHub (usa `gh pr diff <n>`).
- **ruta**: un archivo o carpeta concreta.

## Procedimiento

1. **Delimita el alcance.** Obtén el diff del target. Si es grande, agrúpalo por módulo
   (`src/modules/<x>`, `prisma/`, config).
2. **Corre el gate de calidad** (señal objetiva antes de opinar):

   ```bash
   bash .claude/skills/code-reviewer/scripts/quality_gate.sh
   ```

   Corre ESLint, `tsc --noEmit`, jest y cobertura, y resume PASS/FAIL. Usa esos
   resultados como evidencia, no como veredicto final.
3. **Evalúa los 5 ejes** de `references/rubric.md`, asignando puntos por eje.
4. **Registra hallazgos** con severidad (Blocker / Major / Minor / Nit), cada uno con
   `archivo:línea`, el problema, el porqué (impacto) y una corrección concreta.
5. **Calcula la nota global** (suma de ejes, 0-100) y el **veredicto** según los
   umbrales de la rúbrica.
6. **Emite el reporte** en el formato de abajo.
7. **Integra con GCC** (si `.GCC/` existe o el usuario lo pide): sugiere un COMMIT del
   hito con la nota y el veredicto, p. ej. `code-review auth: 82/100 APPROVE`, para que
   el historial refleje la evolución de calidad. Ver la skill `/gcc`.

## Ejes y pesos (resumen)

| Eje | Peso | Qué mide |
|---|---:|---|
| Correctness & lógica | 30 | Bugs, edge cases, manejo de errores, promesas sin await |
| Seguridad | 25 | AuthN/Z, validación de entrada, secretos, inyección, exposición de datos |
| Clean code & mantenibilidad | 20 | Nombres, tamaño de funciones, duplicación, claridad, tipado |
| Tests | 15 | Cobertura de lo cambiado, casos límite, tests que fallan de verdad |
| Arquitectura & convenciones | 10 | Capas Nest, patrón Prisma del repo, DTOs, límites de módulo |

El detalle de bandas por eje y el mapeo severidad→descuento están en
`references/rubric.md`. **Aplícalo tal cual** para que las notas sean comparables.

## Veredicto (umbrales)

- **≥ 80 y sin Blockers → APPROVE** — mergeable a `master`. Si hay Minor abiertos, ábrelos como seguimiento.
- **70–79 → REQUEST_CHANGES** — cerca del gate; arregla los Major y re-review.
- **50–69 → REQUEST_CHANGES + feedback a memoria** — varios Major; no mergear.
- **< 50 o cualquier Blocker → BLOCK + feedback a memoria** — no mergear bajo ninguna circunstancia.

Reglas duras:
- **Cualquier hallazgo Blocker fuerza BLOCK** sin importar la suma de puntos (secreto commiteado, bypass de auth, pérdida de datos).
- Un review con `quality_gate` en FAIL (build o tests rotos) **no puede superar REQUEST_CHANGES**.
- Si el `quality_gate` no se pudo ejecutar (p. ej. sin `node_modules`), decláralo SKIP en el reporte y **no** cuentes eso como PASS.

## Merge gate para fases terminadas (obligatorio antes de `master`)

Cuando se cierra una **fase** del proyecto (ver roadmap en `.GCC/main.md` / Notion) y se
va a integrar a `master`, aplica este gate **antes** del merge:

1. Corre el review completo sobre el diff de la fase (`git diff master...<rama>`).
2. Calcula la **media de la fase**: si la fase tuvo un solo review, es su nota 0-100.
   Si tuvo varios (varias tareas/PRs), promedia las notas globales de cada uno.
3. **Decisión de merge:**
   - **media ≥ 80 y sin Blockers abiertos → APTA PARA MERGE.** Procede con `/gcc merge`.
   - **media < 80, o hay algún Blocker → NO MERGEAR.** Ejecuta el paso "Feedback a memoria".
4. Deja el resultado del gate registrado con `/gcc commit` (nota por eje + veredicto +
   "APTA / NO APTA para merge"). El historial de `.GCC/` es la evidencia de por qué una
   fase entró o no a `master`.

### Feedback a memoria (cuando la fase NO pasa el gate)

Objetivo: que las fallas graves **no se repitan** en fases futuras. Cuando la media < 80
o hay Blockers:

1. Selecciona los hallazgos **más graves y/o recurrentes** — todos los 🔴 Blocker y los
   🟠 Major que representen un patrón (no los Minor/Nit).
2. Por cada patrón, escribe/actualiza un archivo de memoria en
   `/home/anderson/.claude/projects/-home-anderson-Documentos-Proyectos-Nest-js-moto-care-pro/memory/`
   de tipo `feedback`, con este cuerpo:

   ```markdown
   ---
   name: feedback-<slug-corto>
   description: <regla en una línea que el agente debe seguir en trabajos futuros>
   metadata:
     type: feedback
   ---

   <qué salió mal en la fase X y qué debe hacerse en su lugar>

   **Why:** <impacto concreto — bug, brecha, deuda que costó re-trabajo>
   **How to apply:** <acción verificable la próxima vez: p. ej. "añadir validationSchema
   en ConfigModule y test que falle si falta la env var">
   ```

   Antes de crear uno nuevo, busca un `feedback-*` existente que ya cubra el patrón y
   actualízalo (sube su relevancia) en vez de duplicar.
3. Añade la línea índice en `MEMORY.md`: `- [<Título>](feedback-<slug>.md) — <hook>`.
4. En el reporte del review, lista los **fixes mínimos para volver a pasar el gate**,
   ordenados por gravedad (Blockers → Majors). Esa lista es el plan de corrección.
5. Registra en `.GCC/` (`/gcc commit`) que la fase quedó **NO APTA**, con el enlace a
   los archivos de feedback creados.

Cuando se re-revise la fase tras las correcciones, verifica explícitamente que cada
feedback quedó resuelto y anótalo en la sección "Qué mejoró desde el review anterior".

## Formato del reporte

```
# Code Review — <target>
Fecha: <UTC ISO 8601> · Commit: <sha corto>

## Calificación: <NN>/100 → <VEREDICTO>
| Eje | Puntos |
|---|---|
| Correctness & lógica     | xx/30 |
| Seguridad                | xx/25 |
| Clean code               | xx/20 |
| Tests                    | xx/15 |
| Arquitectura             | xx/10 |

Quality gate: eslint <PASS/FAIL/SKIP> · tsc <PASS/FAIL/SKIP> · tests <PASS/FAIL/SKIP> · cobertura <NN%>

## Merge gate (solo si es cierre de fase)
Media de la fase: <NN>/100 · Umbral: 80 · Blockers abiertos: <0/N>
→ **<APTA PARA MERGE A master / NO APTA>**
Feedback a memoria: <ninguno / feedback-<slug>.md, feedback-<slug>.md>

## Hallazgos
### 🔴 Blockers
- [archivo:línea] problema — impacto — corrección
### 🟠 Major
- ...
### 🟡 Minor
- ...
### ⚪ Nits
- ...

## Qué mejoró desde el review anterior
<comparación con la nota previa registrada en .GCC/ si existe>

## Siguiente paso
<merge / arreglar y re-review / branch para refactor>

## Fixes mínimos para pasar el gate (solo si NO APTA)
1. [🔴/🟠] <fix> — <archivo>
2. ...
```

## Alcance de lenguajes

Optimizada para este repo: TypeScript/NestJS, Prisma, Jest. La rúbrica es agnóstica y
sirve igual para JS, Python, Go, Swift o Kotlin; solo cambia la herramienta del
quality gate.
