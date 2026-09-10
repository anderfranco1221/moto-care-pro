---
name: gcc
description: "Git Context Controller (GCC) - Gestiona la memoria del agente como un sistema de archivos versionado bajo .GCC/. Úsala en proyectos multi-paso que se benefician de persistencia estructurada, seguimiento de hitos, ramas para enfoques alternativos y recuperación de contexto entre sesiones. Se dispara con comandos /gcc o lenguaje natural como 'commitea este progreso', 'crea una rama para probar una alternativa', 'integra los resultados', 'recupera el contexto'."
---

# Git Context Controller (GCC)

## Overview

GCC convierte la memoria del agente de un flujo pasivo de tokens en un sistema de
archivos estructurado y versionado bajo `.GCC/`. Inspirado en Git, expone cuatro
operaciones — **COMMIT, BRANCH, MERGE, CONTEXT** — para persistir hitos, explorar
alternativas de forma aislada, sintetizar resultados y recuperar contexto histórico
de forma eficiente.

Este proyecto (Moto Care Pro) es una exploración por fases (ver `CLAUDE.md` y el
tablero de Notion). GCC es el mecanismo para que cada fase deje un rastro auditable:
qué se intentó, qué se aprendió y qué quedó integrado.

## Initialization

En el primer uso, comprueba si existe `.GCC/` en la raíz del proyecto. Si no existe,
ejecuta el script de inicialización desde la raíz del repo:

```bash
bash .claude/skills/gcc/scripts/gcc_init.sh
```

Crea esta estructura:

```
.GCC/
├── main.md          # Roadmap global y objetivos
├── metadata.yaml    # Estado de infraestructura (ramas, árbol de archivos, config)
├── commit.md        # Historial de commits de la rama main
├── log.md           # Log de ejecución OTA de la rama main
└── branches/        # Workspaces aislados para experimentos
    └── <branch-name>/
        ├── commit.md
        ├── log.md
        └── summary.md
```

Para el formato detallado de cada archivo, lee `references/file_formats.md`.

## Configuration

El comportamiento se controla vía `metadata.yaml`:

- `proactive_commits: true` — Sugiere commits automáticamente al terminar sub-tareas coherentes.
- `proactive_commits: false` — Solo commitea cuando se pide explícitamente.

Alterna con: "activa/desactiva commits proactivos" o editando `metadata.yaml`.

## Commands

### COMMIT

Persiste un hito en la rama actual.

**Disparadores**: `/gcc commit <resumen>`, "commitea este progreso", "guarda este hito", "checkpoint".

**Procedimiento**:
1. Lee el `commit.md` de la rama actual para determinar el siguiente número de commit.
2. Agrega una nueva entrada a `commit.md` con:
   - ID secuencial (p. ej. `[C004]`).
   - Fecha (UTC ISO 8601).
   - Nombre de la rama actual.
   - Propósito de la rama (de `summary.md` si estás en una rama, o de `main.md`).
   - Resumen del progreso previo (1-2 frases del último commit).
   - Aporte de este commit (descripción técnica detallada con archivos tocados).
3. Agrega una entrada OTA a `log.md` registrando la acción de commit.
4. Actualiza el árbol de archivos en `metadata.yaml` si se crearon/modificaron archivos.
5. Si estás en `main`, actualiza la sección de hitos en `main.md`.

**Comportamiento proactivo**: Con `proactive_commits: true`, sugiere un commit tras:
- Completar una función, módulo o unidad de trabajo coherente.
- Arreglar un bug y verificar el fix.
- Terminar una fase de investigación/exploración con conclusiones.
- Cualquier punto donde perder el contexto implicaría rehacer trabajo significativo.

### BRANCH

Crea un workspace aislado para explorar un enfoque alternativo.

**Disparadores**: `/gcc branch <nombre>`, "crea una rama para probar...", "explora la alternativa...", "experimenta con...".

**Procedimiento**:
1. Crea el directorio `.GCC/branches/<branch-name>/`.
2. Crea `summary.md` con: propósito, rama padre, fecha de creación, hipótesis clave.
3. Crea `commit.md` y `log.md` vacíos para la rama.
4. Actualiza `metadata.yaml` para registrar la nueva rama.
5. Actualiza la sección "Active Branches" de `main.md`.
6. Registra la creación de la rama en el `log.md` de la rama padre.

Desde ese punto, todos los COMMIT y logs OTA van a los archivos de la rama hasta un
MERGE o cambio de rama explícito.

### MERGE

Integra una rama completada de vuelta al flujo principal.

**Disparadores**: `/gcc merge <rama>`, "integra los resultados de...", "integra el experimento", "la rama X está lista".

**Gate de validación obligatorio (fases → `master`)**:

Antes de sintetizar el merge de una rama que cierra una **fase** del proyecto:

0. Invoca la skill **`code-reviewer`** sobre el diff de la fase (`git diff master...<rama>`)
   y aplica su **Merge gate**:
   - **media ≥ 80/100 y sin Blockers → continúa** con el procedimiento de abajo.
   - **media < 80 o hay Blockers → ABORTA el merge.** No escribas el commit de síntesis.
     La skill `code-reviewer` ya habrá escrito los `feedback-*` en la memoria del agente
     con las fallas graves; registra en el `log.md` de la rama que el merge quedó
     bloqueado, lista los fixes mínimos y deja la rama en `Active Branches`.
   Ramas de experimento puro (no cierran fase) pueden mergearse/abandonarse sin gate,
   pero indica en el commit de síntesis que no hubo review formal.

**Procedimiento** (solo si el gate pasó):
1. Lee el `summary.md` y `commit.md` de la rama para entender los resultados.
2. Agrega un commit de síntesis al `commit.md` de main resumiendo:
   - Qué se intentó.
   - Qué se aprendió.
   - Qué se está integrando (o por qué se abandona la rama).
   - **La nota del merge gate** (media de la fase + veredicto APTA/NO APTA).
3. Actualiza `main.md`:
   - Agrega una entrada de hito con los resultados de la rama y la nota del gate.
   - Quítala de "Active Branches".
   - Actualiza los objetivos si aplica.
4. Actualiza `metadata.yaml`: pon el estado de la rama en `merged` o `abandoned`.
5. Registra el merge en el `log.md` de main.
6. Si en el gate se creó algún `feedback-*` en la memoria del agente, enlázalo desde el
   commit de síntesis para trazabilidad.

### CONTEXT

Recupera memoria histórica a distintos niveles de resolución.

**Disparadores**: `/gcc context <flag>`, "qué hicimos en...", "recupera el contexto", "muéstrame el historial", "dónde estábamos".

**Flags**:

- `--branch [nombre]` — Lee `summary.md` y los últimos commits de una rama (o la rama actual si no se da nombre). Entendimiento de alto nivel de qué pasó y por qué.
- `--log [n]` — Lee las últimas N entradas (por defecto 20) del `log.md` de la rama actual. Trazas OTA de grano fino para depurar o reanudar trabajo interrumpido.
- `--metadata` — Lee `metadata.yaml` para recuperar estructura: árbol de archivos, dependencias, ramas activas, configuración.
- `--full` — Lee `main.md` para el roadmap completo, todos los hitos y ramas activas. Úsalo para recuperación entre sesiones o handoff a otro agente.

Sin flag, por defecto usa `--branch` para la rama activa actual.

## OTA Logging

Durante todo el trabajo (no solo en comandos explícitos), mantén el log de ejecución OTA:

1. **Observation**: Qué se notó o descubrió.
2. **Thought**: Razonamiento sobre qué hacer a continuación.
3. **Action**: Qué acción se tomó.

Agrega entradas al `log.md` de la rama activa. Máximo 50 entradas; al exceder, elimina
las más antiguas. Cada entrada lleva ID secuencial, timestamp y nombre de rama.

Registra entradas OTA en puntos de decisión significativos — no cada acción, sino
observaciones importantes, cambios de estrategia y resultados.

## Cross-Session Recovery

Al iniciar una nueva sesión sobre un proyecto con `.GCC/`:

1. Lee `metadata.yaml` para entender el estado del proyecto y las ramas activas.
2. Lee `main.md` para el roadmap global y objetivos.
3. Lee los últimos commits y entradas de log de la rama activa.
4. Reanuda el trabajo con contexto completo de lo hecho y lo pendiente.

## Integración con code-reviewer

El flujo típico de este proyecto une revisión de calidad y memoria versionada:

1. Antes de cerrar una fase o feature, invoca la skill **`code-reviewer`** para obtener
   una calificación 0-100 y un veredicto.
2. Haz **COMMIT** del hito incluyendo el puntaje por eje y el veredicto en el aporte del
   commit (p. ej. `code-review: 82/100 APPROVE`). Así el historial de `.GCC/` conserva
   la evolución de la calidad y permite mejorar continuamente comparando revisiones.
3. **Ninguna fase entra a `master` con media < 80/100 o con Blockers.** El MERGE ejecuta
   ese gate automáticamente (ver arriba). Si no pasa, `code-reviewer` deja `feedback-*`
   en la memoria del agente con las fallas graves y su corrección; el trabajo futuro
   debe respetarlas.
4. Si el review pide cambios grandes o arriesgados, crea una **BRANCH** para el refactor
   y **MERGE** cuando el re-review alcance la media de 80.

## Natural Language Mapping

| El usuario dice | Comando |
|---|---|
| "guarda/checkpoint/persiste esto" | COMMIT |
| "prueba un enfoque distinto" | BRANCH |
| "ese experimento funcionó, intégralo" | MERGE |
| "¿dónde estábamos?" / "¿cuál es el estado?" | CONTEXT --full |
| "¿qué pasó en la rama X?" | CONTEXT --branch X |
| "muéstrame la actividad reciente" | CONTEXT --log |
| "¿qué archivos tenemos?" | CONTEXT --metadata |
| "activa/desactiva auto-commits" | Alterna `proactive_commits` en metadata.yaml |
