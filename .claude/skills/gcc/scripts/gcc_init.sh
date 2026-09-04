#!/usr/bin/env bash
# GCC init: crea la estructura .GCC/ si no existe. Idempotente: no sobrescribe
# archivos ya presentes.
set -euo pipefail

ROOT="${1:-.}"
GCC_DIR="$ROOT/.GCC"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ -d "$GCC_DIR" ]; then
  echo "GCC ya inicializado en $GCC_DIR (no se toca nada)."
  exit 0
fi

mkdir -p "$GCC_DIR/branches"

cat > "$GCC_DIR/main.md" <<EOF
# Moto Care Pro — Roadmap (GCC main)

> Memoria versionada del proyecto. Editada por la skill \`/gcc\`.
> Creado: $NOW

## Objetivos

- Backend NestJS 11 para taller de motos (bikes, services, appointments).
- Objetivo de exploración: multitenancy por schemas de PostgreSQL (ver README).

## Milestones

<!-- Cada COMMIT en main agrega o actualiza un hito aquí. -->

## Active Branches

<!-- BRANCH registra ramas activas aquí; MERGE las retira. -->

_(ninguna)_
EOF

cat > "$GCC_DIR/metadata.yaml" <<EOF
# Estado de infraestructura de GCC. Editado por la skill /gcc.
version: 1
created: "$NOW"
config:
  proactive_commits: true
current_branch: main
branches:
  main:
    status: active
    created: "$NOW"
    parent: null
file_tree:
  # Rutas relevantes que GCC rastrea. Se actualiza en cada COMMIT.
  - .GCC/
EOF

cat > "$GCC_DIR/commit.md" <<EOF
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
EOF

cat > "$GCC_DIR/log.md" <<EOF
# OTA log — branch: main

<!--
Formato de entrada (máx 50, FIFO):

### [L001] <UTC ISO 8601> (main)
- O: <observation>
- T: <thought>
- A: <action>
-->
EOF

echo "GCC inicializado en $GCC_DIR"
