# Rúbrica de Code Review (0-100)

Objetivo: notas **reproducibles y comparables entre revisiones**. Dos personas
aplicando esta rúbrica al mismo diff deberían llegar a ±5 puntos. Cada eje parte de su
puntaje máximo y se descuenta por hallazgo según la tabla de severidad.

## Severidad → descuento

| Severidad | Definición | Descuento por hallazgo |
|---|---|---:|
| 🔴 Blocker | Rompe en producción, brecha de seguridad, pérdida de datos, bypass de auth, secreto expuesto | −15 (y fuerza veredicto BLOCK) |
| 🟠 Major | Bug con condiciones realistas, sin manejo de error, falta validación en entrada externa, contrato roto | −8 |
| 🟡 Minor | Edge case improbable, duplicación, mala abstracción, test faltante no crítico | −3 |
| ⚪ Nit | Estilo, nombre mejorable, comentario, orden de imports | −1 (máx −3 en total por eje) |

Los descuentos se aplican **dentro del eje** al que pertenece el hallazgo y el eje no
baja de 0.

## Ejes

### 1. Correctness & lógica — 30 pts
Mide si el código hace lo que dice sin romperse.
- Bandas de referencia:
  - **27-30**: lógica correcta, edge cases cubiertos, errores manejados, sin promesas colgadas.
  - **20-26**: correcto en el camino feliz, algún edge case o manejo de error flojo (Minor/Major aislado).
  - **10-19**: uno o más Major (bug con condiciones realistas, falta de manejo de error en I/O).
  - **0-9**: Blocker de correctness o varios Major.
- Señales: `@typescript-eslint/no-floating-promises`, valores no verificados, `null`/`undefined`, off-by-one, estados imposibles.

### 2. Seguridad — 25 pts
- Bandas:
  - **23-25**: authN/Z correctas, entrada externa validada, sin secretos, queries parametrizadas (Prisma), no se filtran datos sensibles (p. ej. password hash en respuestas).
  - **16-22**: falta un control defensivo no crítico (Minor/Major).
  - **8-15**: Major de seguridad (validación ausente en endpoint público, dato sensible expuesto).
  - **0-7**: Blocker (secreto commiteado, bypass de auth, password en claro, inyección).
- Señales específicas de este repo: comparación de password en claro, DTOs sin `class-validator`/`ValidationPipe`, `dto as Prisma.*Input` sin validación, `DATABASE_URL`/JWT secret hardcodeado.

### 3. Clean code & mantenibilidad — 20 pts
- Bandas:
  - **18-20**: nombres claros, funciones cortas y con un propósito, sin duplicación, tipado honesto (evita `any`), sin sobre-ingeniería.
  - **13-17**: algún nombre ambiguo, función larga, duplicación menor.
  - **7-12**: varias funciones grandes, duplicación notable, `any` extendido.
  - **0-6**: ilegible o muy acoplado.
- Aplica la skill `clean-code` del repo como criterio.

### 4. Tests — 15 pts
- Bandas:
  - **14-15**: lo cambiado tiene tests que **fallarían** si se rompe la lógica; cubre casos límite; verdes.
  - **10-13**: tests presentes pero superficiales o falta algún caso.
  - **5-9**: cobertura parcial de lo cambiado.
  - **0-4**: sin tests para código nuevo con lógica, o tests rotos.
- Usa la cobertura del quality gate como dato, no como nota automática (100% de líneas con asserts triviales no vale 15).

### 5. Arquitectura & convenciones — 10 pts
- Bandas:
  - **9-10**: respeta capas Nest (module/controller/service/dto), el patrón Prisma no estándar del repo (importar `PrismaModule`, `PrismaService`, URL en `prisma.config.ts`, schema partido en `prisma/schema/`), límites de módulo.
  - **6-8**: desvío menor de convención.
  - **3-5**: rompe una convención del repo (p. ej. no importa `PrismaModule` donde debe).
  - **0-2**: viola el layering o mete lógica en el lugar equivocado.
- Referencia: `CLAUDE.md` (sección Architecture y Conventions & gotchas).

## Cálculo

```
nota = correctness + seguridad + clean + tests + arquitectura   # 0..100
```

Veredicto por umbral (con las reglas duras de la skill):
- ≥ 80 y sin Blockers → APPROVE (mergeable a `master`)
- 70-79 → REQUEST_CHANGES (cerca del gate)
- 50-69 → REQUEST_CHANGES + feedback a memoria
- < 50 o cualquier 🔴 Blocker → BLOCK + feedback a memoria
- quality_gate build/tests en FAIL → tope REQUEST_CHANGES.

**Merge gate de fase:** una fase terminada solo entra a `master` con **media ≥ 80/100**
y **cero Blockers abiertos**. Media = nota global si hubo un review; promedio de las
notas globales si la fase tuvo varias tareas/PRs. Si no pasa, la skill escribe
`feedback-*` en la memoria del agente con las fallas graves (Blockers + Majors
recurrentes) y su **How to apply**, para que no se repitan en fases futuras.

## Continuidad (mejora continua)

Al registrar el review en `.GCC/` (COMMIT vía skill `/gcc`), incluye la nota por eje.
En el siguiente review del mismo módulo, compara eje por eje y reporta deltas en la
sección "Qué mejoró desde el review anterior". Eso convierte la calificación en una
señal de tendencia, no en un juicio aislado.
