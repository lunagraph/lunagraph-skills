#!/bin/sh
# Copy the shared checklist from the design skill into every other skill.
# Each skill keeps its own copy so it still works when installed on its own.
set -e
cd "$(dirname "$0")/.."
src=skills/design/references/checklist.md
for dir in skills/*/; do
  [ "$dir" = "skills/design/" ] && continue
  mkdir -p "${dir}references"
  cp "$src" "${dir}references/checklist.md"
done
